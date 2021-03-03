import React from 'react';

import RepoLabel from 'app/components/repoLabel';

export default {
  title: 'Core/Tags/RepoLabel',
};

export const Default = () => {
  return <RepoLabel>prod</RepoLabel>;
};

Default.storyName = 'default';
