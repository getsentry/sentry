import {withInfo} from '@storybook/addon-info';

import ProjectLabel from 'app/components/projectLabel';

export default {
  title: 'Deprecated/ProjectLabel',
};

export const Default = withInfo('Do not use this, use IdBadge instead')(() => {
  return (
    <ProjectLabel
      project={{name: 'Project Name', slug: 'project-name'}}
      organization={{slug: 'test-org', features: []}}
    />
  );
});

Default.story = {
  name: 'default',
};
