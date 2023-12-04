## EKS Cluster playground with CDK & Typescript

what I'm trying to do is to create an EKS cluster following IaC logic. 
At the same time, other AWS resources that will be consumed by EKS workloads will be created in the same app.
However, stateful components are organized in a separate stack.
Karpenter is used as the autoscaling solution.
