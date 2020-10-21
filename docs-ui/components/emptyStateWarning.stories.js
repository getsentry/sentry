import {withInfo} from '@storybook/addon-info';

import EmptyStateWarning from 'app/components/emptyStateWarning';

export default {
  title: 'Layouts/EmptyState/EmptyStateWarning',
};

export const Default = withInfo('Default')(() => (
  <EmptyStateWarning data="https://example.org/foo/bar/">
    <p>There are no events found!</p>
  </EmptyStateWarning>
));

Default.story = {
  name: 'default',
};
