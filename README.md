## EKS Cluster playground with CDK & Typescript

1. what I'm trying to do is to create an EKS cluster following IaC logic. 
2. At the same time, other AWS resources that will be consumed by EKS workloads will be created in the same app.
3. However, stateful components are organized in a separate stack.
4. Karpenter is used as the autoscaling solution (MNG is used to host Karpenter deployment).
5. Initial worker node count is limited to 1 for demo purposes. 
6. Simply run cdk diff/deploy --all ro provision the services to active aws account ("aws sts get-caller-identity" account )
7. For context usage with different environments (optional)
   a.  Bootstraping and installing dependencies, 
   b.  Run --> cdk diff/deploy --all --context env_name=dev
8. After you're done, don't forget to destroy  the resources with "cdk destroy --all" to avoid unnecessary costs.