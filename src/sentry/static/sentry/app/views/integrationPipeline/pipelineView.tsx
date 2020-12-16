import React from 'react';

import ThemeAndStyleProvider from 'app/themeAndStyleProvider';

import AwsLambdaFunctionSelect from './awsLambdaFunctionSelect';
import AwsLambdaProjectSelect from './awsLambdaProjectSelect';
import AwsLambdFailureDetails from './awsLambdFailureDetails';

/**
 * This component is a wrapper for specific pipeline views for integrations
 */

const pipelineMapper = {
  awsLambdaProjectSelect: AwsLambdaProjectSelect,
  awsLambdaFunctionSelect: AwsLambdaFunctionSelect,
  awsLambdFailureDetails: AwsLambdFailureDetails,
};

type Props = {
  pipelineName: string;
  [key: string]: any;
};

const PipelineView = (props: Props) => {
  const {pipelineName, ...rest} = props;
  const Component = pipelineMapper[pipelineName];
  if (!Component) {
    throw new Error(`Invalid pipeline name ${pipelineName}`);
  }
  return (
    <ThemeAndStyleProvider>
      <Component {...rest} />
    </ThemeAndStyleProvider>
  );
};

export default PipelineView;
