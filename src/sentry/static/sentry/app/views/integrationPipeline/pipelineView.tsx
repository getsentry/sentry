import React from 'react';

import ThemeAndStyleProvider from 'app/themeAndStyleProvider';

import AwsLambdaFailureDetails from './awsLambdaFailureDetails';
import AwsLambdaFunctionSelect from './awsLambdaFunctionSelect';
import AwsLambdaProjectSelect from './awsLambdaProjectSelect';

/**
 * This component is a wrapper for specific pipeline views for integrations
 */

const pipelineMapper: Record<string, [React.ElementType, string]> = {
  awsLambdaProjectSelect: [AwsLambdaProjectSelect, 'Select Project'],
  awsLambdaFunctionSelect: [AwsLambdaFunctionSelect, 'Select Lambdas'],
  awsLambdaFailureDetails: [AwsLambdaFailureDetails, 'View Failures'],
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
        <Component {...this.props} />
      </ThemeAndStyleProvider>
    );
  }
}
