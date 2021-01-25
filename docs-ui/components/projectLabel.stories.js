import React from 'react';

import ProjectLabel from 'app/components/projectLabel';

export default {
  title: 'Deprecated/ProjectLabel',
};

export const Default = () => {
  return (
    <ProjectLabel
      project={{name: 'Project Name', slug: 'project-name'}}
      organization={{slug: 'test-org', features: []}}
    />
  );
};

Default.storyName = 'default';
Default.parameters = {
  docs: {
    description: {
      story: 'Do not use this, use IdBadge instead',
    },
  },
};
