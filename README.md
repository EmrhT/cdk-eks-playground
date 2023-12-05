## EKS Cluster playground with CDK & Typescript

1. what I'm trying to do is to create an EKS cluster following IaC logic. 
2. At the same time, other AWS resources that will be consumed by EKS workloads will be created in the same app.
3. However, stateful components are organized in a separate stack.
4. Karpenter is used as the autoscaling solution.
5. Context usage for different environments are just for demonstrative purposes. 
6. after bootstraping and installing dependencies, simply run --> cdk diff/deploy --all --context env_name=dev
