import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { KubectlV27Layer } from '@aws-cdk/lambda-layer-kubectl-v27';
import { App, CfnOutput, Duration } from 'aws-cdk-lib';
import { Karpenter, AMIFamily, ArchType, CapacityType } from "cdk-karpenter";
import { InstanceClass, InstanceSize, InstanceType, EbsDeviceVolumeType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IBucket } from 'aws-cdk-lib/aws-s3';


interface ClusterStackProps extends cdk.StackProps {
  playgroundTable: ITable,
  playgroundBucket: IBucket,
}


export class PlaygroundEksStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ClusterStackProps) {
    super(scope, id, props);

    const mastersRole = new cdk.aws_iam.Role(this, 'MastersRole', {
      assumedBy: new cdk.aws_iam.ArnPrincipal('arn:aws:iam::597947213367:user/emrah-jgnk-iam'), // change me!
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
      minSize: cluster.node.tryGetContext("node_group_min_size"),
      desiredSize: 1,
      maxSize: cluster.node.tryGetContext("node_group_max_size"),
      diskSize: 100,
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      capacityType: eks.CapacityType.SPOT, 
    });

    // for more objects of the same type, use for loops for creation
    const serviceAccountS3 = cluster.addServiceAccount('S3BucketSA', {
      name: 's3bucket-sa',
      namespace: 'default',
      annotations: {
        'eks.amazonaws.com/sts-regional-endpoints': 'false',
      },
      labels: {
        'test-label': 'test-value',
      },
    });

    const serviceAccountDynamoDB = cluster.addServiceAccount('DynamoDBSA', {
      name: 'dynamodb-sa',
      namespace: 'default',
      annotations: {
        'eks.amazonaws.com/sts-regional-endpoints': 'false',
      },
      labels: {
        'test-label': 'test-value',
      },
    });

    new CfnOutput(this, 'S3ServiceAccountIamRole', { value: serviceAccountS3.role.roleArn });
    new CfnOutput(this, 'DynamoDBServiceAccountIamRole', { value: serviceAccountDynamoDB.role.roleArn });

    props?.playgroundBucket.grantReadWrite(serviceAccountS3);
    props?.playgroundTable.grantReadWriteData(serviceAccountDynamoDB);

    const karpenter = new Karpenter(this, 'karpenter', {
      cluster: cluster,
      vpc: vpc,
    });

    // custom provisoner for spot instances
    karpenter.addProvisioner('customSpot', {
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
        capacityType: 'spot',
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
      }
    }),

    // custom provisoner for ondemand instances
    karpenter.addProvisioner('customOnDemand', {
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
        capacityTypes: [CapacityType.ON_DEMAND]
      },
      ttlSecondsAfterEmpty: Duration.minutes(1),
      ttlSecondsUntilExpired: Duration.days(90),
      labels: {
        capacityType: 'ondemand',
      },
      limits: {
        cpu: '5',
        mem: '500Gi',
      },
      consolidation: false,
      provider: {
        amiFamily: AMIFamily.AL2,
        tags: {
          Foo: 'Bar',
        },
      }
    });

  }
}


