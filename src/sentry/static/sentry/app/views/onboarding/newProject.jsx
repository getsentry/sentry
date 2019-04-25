import React from 'react';

import CreateProject from 'app/components/createProject';

const NewProject = props => (
  <CreateProject
    {...props}
    nextStepUrl={({slug, projectSlug, platform}) =>
      `/onboarding/${slug}/${projectSlug}/configure/${platform}/`
    }
  />
);

export default NewProject;
