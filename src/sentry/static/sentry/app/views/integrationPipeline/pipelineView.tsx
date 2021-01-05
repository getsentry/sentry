import React from 'react';

import Indicators from 'app/components/indicators';
import ThemeAndStyleProvider from 'app/themeAndStyleProvider';

import AwsLambdaFailureDetails from './awsLambdaFailureDetails';
import AwsLambdaFunctionSelect from './awsLambdaFunctionSelect';
import AwsLambdaProjectSelect from './awsLambdaProjectSelect';

/**
 * This component is a wrapper for specific pipeline views for integrations
 */

const pipelineMapper = {
  awsLambdaProjectSelect: AwsLambdaProjectSelect,
  awsLambdaFunctionSelect: AwsLambdaFunctionSelect,
  awsLambdaFailureDetails: AwsLambdaFailureDetails,
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
      <Indicators className="indicators-container" />
      <Component {...rest} />
    </ThemeAndStyleProvider>
  );
};

export default PipelineView;
