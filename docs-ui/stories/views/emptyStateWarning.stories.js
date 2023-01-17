import {action} from '@storybook/addon-actions';

import {Button} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {IconClose} from 'sentry/icons';

export default {
  title: 'Views/Empty States/Empty State Warning',
  component: EmptyStateWarning,
};

export const Default = () => (
  <EmptyStateWarning data="https://example.org/foo/bar/">
    <p>There are no events found!</p>
  </EmptyStateWarning>
);

export const WithInnerButton = () => (
  <EmptyStateWarning data="https://example.org/foo/bar/">
    <p>There are no events found!</p>
    <Button
      size="sm"
      icon={<IconClose color="gray500" size="md" isCircled />}
      onClick={action('click')}
    >
      Clear filters
    </Button>
  </EmptyStateWarning>
);

Default.storyName = 'Empty State Warning';
