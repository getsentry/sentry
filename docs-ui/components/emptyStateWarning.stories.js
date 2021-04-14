import React from 'react';

import EmptyStateWarning from 'app/components/emptyStateWarning';

export default {
  title: 'Layouts/EmptyState/EmptyStateWarning',
  component: EmptyStateWarning,
};

export const Default = () => (
  <EmptyStateWarning data="https://example.org/foo/bar/">
    <p>There are no events found!</p>
  </EmptyStateWarning>
);

Default.storyName = 'EmptyStateWarning';
