import { aws_s3, Stack, StackProps } from 'aws-cdk-lib'
import { AttributeType, ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';


export class DataStack extends Stack {

    public readonly playgroundTable: ITable
    public readonly playgroundBucket: IBucket

    constructor(scope: Construct, id : string, props?: StackProps) {
        super(scope, id, props)

        this.playgroundTable = new Table(this, 'PlaygroundTable', {
            partitionKey:  {
                name: 'id',
                type: AttributeType.STRING
            },
        })

        this.playgroundBucket = new aws_s3.Bucket(this, 'PlaygroundBucket', {});

    }
}

