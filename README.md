# EKS Cluster playground with AWS CDK & Typescript

1. This repo is linked to a medium story which has more on the topic --> https://emrah-t.medium.com/deploying-an-eks-cluster-with-aws-cloud-development-kit-cdk-afdb96ce3a83
2. What I'm trying to do is to create an EKS cluster following IaC logic. 
3. At the same time, other AWS resources that will be consumed by EKS workloads will be created in the same app.
4. However, stateful components (S3 and Dynamo) are organized in a separate stack.
5. Karpenter is used as the autoscaling solution (MNG is used to host Karpenter deployment).
6. Initial worker node count is limited to 1 for demo purposes.

## How to run
1. Follow the steps described in https://cdkworkshop.com/20-typescript/20-create-project/100-cdk-init.html to initiate a blank typescript project and bootstrap CDK objects in CloudFormation.
2. Simply run `cdk diff/deploy --all` to provision the services to active aws account (`aws sts get-caller-identity` account )
3. After you're done, don't forget to destroy  the resources with `cdk destroy --all` to avoid unnecessary costs.

## For context usage with different environments (optional)
1. Bootstraping, installing dependencies and initiating the project as described above. 
2. Run `cdk diff/deploy --all --context env_name=dev`
