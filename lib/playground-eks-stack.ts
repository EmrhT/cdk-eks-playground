import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { KubectlV28Layer } from '@aws-cdk/lambda-layer-kubectl-v28';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Karpenter, AMIFamily, ArchType, CapacityType } from "cdk-karpenter";
import { InstanceClass, InstanceSize, InstanceType} from 'aws-cdk-lib/aws-ec2';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IBucket } from 'aws-cdk-lib/aws-s3';



interface ClusterStackProps extends cdk.StackProps {  // stack objects that you'll consume is added  with interfaces
  playgroundTable: ITable,                            // such as dynamodb table and S3 bucket here
  playgroundBucket: IBucket,
}


export class PlaygroundEksStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ClusterStackProps) {
    super(scope, id, props);

    const mastersRole = new cdk.aws_iam.Role(this, 'MastersRole', {
      assumedBy: new cdk.aws_iam.ArnPrincipal('arn:aws:iam::444469924026:user/cdk-deploy-user'), // change me!
    });

    const vpc = new ec2.Vpc(this, 'VPC');

    const cluster = new eks.Cluster(this, 'hello-eks', {
      mastersRole,
      vpc: vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      version: eks.KubernetesVersion.V1_28,
      defaultCapacity: 0,
      clusterLogging: [
        eks.ClusterLoggingTypes.API,
        eks.ClusterLoggingTypes.AUTHENTICATOR,
        eks.ClusterLoggingTypes.AUDIT,
      ],
      kubectlLayer: new KubectlV28Layer(this, 'kubectl')
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
      nodegroupName: "custom-node-group",
      instanceTypes: [new ec2.InstanceType('m5.large')],
      minSize: cluster.node.tryGetContext("node_group_min_size"),
      desiredSize: 1,
      maxSize: cluster.node.tryGetContext("node_group_max_size"),
      diskSize: 100,
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      capacityType: eks.CapacityType.SPOT, 
    });

    // for more objects of the same type, use for loops for creation
    const serviceAccountEFS = cluster.addServiceAccount('EFSSA', {
      name: 'efs-sa',
      namespace: 'kube-system',
      annotations: {
        'eks.amazonaws.com/sts-regional-endpoints': 'false',
      },
      labels: {
        'test-label': 'test-value',
      },
    });

    serviceAccountEFS.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEFSCSIDriverPolicy'));

    // adding EFS addon to experience cfnAddon construct's implementation
    const cfnAddon = new eks.CfnAddon(this, 'aws-efs-csi-driver', {
      addonName: 'aws-efs-csi-driver',
      clusterName: cluster.clusterName,

      // the properties below are optional
      // addonVersion: 'addonVersion',
      // configurationValues: 'configurationValues',
      // preserveOnDelete: false,
      // resolveConflicts: 'resolveConflicts',
      serviceAccountRoleArn: serviceAccountEFS.role.roleArn,
      tags: [{
        key: 'key1',
        value: 'value1',
      }],
    });

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
    
    new CfnOutput(this, 'EFSServiceAccountIamRole', { value: serviceAccountEFS.role.roleArn });
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


