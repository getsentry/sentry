import * as React from 'react';

import Indicators from 'app/components/indicators';
import ThemeAndStyleProvider from 'app/themeAndStyleProvider';

import AwsLambdaCloudformation from './awsLambdaCloudformation';
import AwsLambdaFailureDetails from './awsLambdaFailureDetails';
import AwsLambdaFunctionSelect from './awsLambdaFunctionSelect';
import AwsLambdaProjectSelect from './awsLambdaProjectSelect';

/**
 * This component is a wrapper for specific pipeline views for integrations
 */

const pipelineMapper: Record<string, [React.ElementType, string]> = {
  awsLambdaProjectSelect: [AwsLambdaProjectSelect, 'AWS Lambda Select Project'],
  awsLambdaFunctionSelect: [AwsLambdaFunctionSelect, 'AWS Lambda Select Lambdas'],
  awsLambdaCloudformation: [AwsLambdaCloudformation, 'AWS Lambda Create Cloudformation'],
  awsLambdaFailureDetails: [AwsLambdaFailureDetails, 'AWS Lambda View Failures'],
};

type Props = {
  pipelineName: string;
  [key: string]: any;
};

export default class PipelineView extends React.Component<Props> {
  componentDidMount() {
    // update the title based on our mappings
    const title = this.mapping[1];
    document.title = title;
  }
  get mapping() {
    const {pipelineName} = this.props;
    const mapping = pipelineMapper[pipelineName];
    if (!mapping) {
      throw new Error(`Invalid pipeline name ${pipelineName}`);
    }
    return mapping;
  }
  render() {
    const Component = this.mapping[0];
    return (
      <ThemeAndStyleProvider>
        <Indicators className="indicators-container" />
        <Component {...this.props} />
      </ThemeAndStyleProvider>
    );
  }
}
