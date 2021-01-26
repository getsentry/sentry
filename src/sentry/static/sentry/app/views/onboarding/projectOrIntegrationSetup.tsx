import React from 'react';
import * as qs from 'query-string';

import IntegrationSetup from './integrationSetup';
import ProjectSetup from './projectSetup';

const platfromToIntegrationMap = {
  'node-awslambda': 'aws_lambda',
};

type Props = React.ComponentProps<typeof ProjectSetup> &
  Omit<React.ComponentProps<typeof IntegrationSetup>, 'integrationSlug'>;

const ProjectOrIntegrationSetup = (props: Props) => {
  const parsed = qs.parse(window.location.search);
  const {platform} = props;
  const integrationSlug = platform && platfromToIntegrationMap[platform];
  // check for manual override query param
  if (integrationSlug && parsed.manual !== '1') {
    return <IntegrationSetup integrationSlug={integrationSlug} {...props} />;
  }
  return <ProjectSetup {...props} />;
};

export default ProjectOrIntegrationSetup;
