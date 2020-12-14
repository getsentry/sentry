import React from 'react';

import ThemeAndStyleProvider from 'app/themeAndStyleProvider';

import AwsLambdaProjectSelect from './awsLambdaProjectSelect';

/**
 * This component is a wrapper for specific pipeline views for integrations
 */

const pipelineMapper = {
  awsLambdaProjectSelect: AwsLambdaProjectSelect,
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
