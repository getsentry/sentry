import React from 'react';

import AwsLambdaProjectSelect from 'app/integrationPopupViews/awsLambdaProjectSelect';
import Main from 'app/main';

const pipelineMapper = {
  awsLambdaProjectSelect: AwsLambdaProjectSelect,
};

type Props = {
  pipelineName: string;
  [key: string]: any;
};

const Pipeline = (props: Props) => {
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

export default Pipeline;
