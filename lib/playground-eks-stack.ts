import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { KubectlV27Layer } from '@aws-cdk/lambda-layer-kubectl-v27';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Karpenter, AMIFamily, ArchType, CapacityType } from "cdk-karpenter";
import { InstanceClass, InstanceSize, InstanceType, EbsDeviceVolumeType, Vpc } from 'aws-cdk-lib/aws-ec2';


export class PlaygroundEksStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const mastersRole = new cdk.aws_iam.Role(this, 'MastersRole', {
      assumedBy: new cdk.aws_iam.ArnPrincipal('arn:aws:iam::597947213367:user/emrah-jgnk-iam'),
    });

    const vpc = new ec2.Vpc(this, 'VPC');

    const cluster = new eks.Cluster(this, 'hello-eks', {
      mastersRole,
      vpc: vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      version: eks.KubernetesVersion.V1_27,
      defaultCapacity: 0,
      albController: {
        version: eks.AlbControllerVersion.V2_6_2,
      },
      clusterLogging: [
        eks.ClusterLoggingTypes.API,
        eks.ClusterLoggingTypes.AUTHENTICATOR,
        eks.ClusterLoggingTypes.SCHEDULER,
      ],
      kubectlLayer: new KubectlV27Layer(this, 'kubectl')
    });

    mastersRole.addToPolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        'eks:AccessKubernetesApi',
        'eks:Describe*',
        'eks:List*',
    ],
      resources: [ cluster.clusterArn ],
    }));

    cluster.addNodegroupCapacity('custom-node-group', {
      instanceTypes: [new ec2.InstanceType('m5.large')],
      minSize: 1,
      maxSize: 1,
      diskSize: 100,
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      capacityType: eks.CapacityType.SPOT,
    });

    const serviceAccount = cluster.addServiceAccount('S3BucketSA', {
      name: 's3bucket-sa',
      namespace: 'default',
      annotations: {
        'eks.amazonaws.com/sts-regional-endpoints': 'false',
      },
      labels: {
        'test-label': 'test-value',
      },
    });

    const bucket = new cdk.aws_s3.Bucket(this, 'PlaygroundBucket', {});
    bucket.grantReadWrite(serviceAccount);
    new CfnOutput(this, 'ServiceAccountIamRole', { value: serviceAccount.role.roleArn });

    
    const karpenter = new Karpenter(this, 'karpenter', {
      cluster,
      vpc,
    });

    // custom provisoner - kitchen sink
    karpenter.addProvisioner('custom', {
      requirements: {
        archTypes: [ArchType.AMD64],
        instanceTypes: [
          InstanceType.of(InstanceClass.M5, InstanceSize.LARGE),
          InstanceType.of(InstanceClass.M5A, InstanceSize.LARGE),
          InstanceType.of(InstanceClass.M6G, InstanceSize.LARGE),
        ],
        restrictInstanceTypes: [
          InstanceType.of(InstanceClass.G5, InstanceSize.LARGE),
        ],
        capacityTypes: [CapacityType.SPOT]
      },
      ttlSecondsAfterEmpty: Duration.minutes(1),
      ttlSecondsUntilExpired: Duration.days(90),
      labels: {
        billing: 'my-team',
      },
      limits: {
        cpu: '10',
        mem: '1000Gi',
      },
      consolidation: false,
      provider: {
        amiFamily: AMIFamily.AL2,
        tags: {
          Foo: 'Bar',
        },
      },
    
    
    });
  }
}


