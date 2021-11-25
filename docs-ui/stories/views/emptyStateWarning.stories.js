import EmptyStateWarning from 'sentry/components/emptyStateWarning';

export default {
  title: 'Views/Empty States/Empty State Warning',
  component: EmptyStateWarning,
};

export const Default = () => (
  <EmptyStateWarning data="https://example.org/foo/bar/">
    <p>There are no events found!</p>
  </EmptyStateWarning>
);

Default.storyName = 'Empty State Warning';
