#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PlaygroundEksStack } from '../lib/playground-eks-stack';
import { DataStack } from '../lib/DataStack';

const app = new cdk.App();
const dataStack = new DataStack(app, 'DataStack');
new PlaygroundEksStack(app, 'PlaygroundEksStack', {
  playgroundTable: dataStack.playgroundTable,
  playgroundBucket: dataStack.playgroundBucket,
});

