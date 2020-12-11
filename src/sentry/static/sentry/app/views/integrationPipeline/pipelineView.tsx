import React from 'react';

import Main from 'app/main';

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
    <Main>
      <Component {...rest} />
    </Main>
  );
};

export default PipelineView;
