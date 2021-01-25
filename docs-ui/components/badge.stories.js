import React from 'react';

import Badge from 'app/components/badge';

export default {
  title: 'Core/Badges+Tags/Badge',
  component: Badge,
  parameters: {
    controls: {hideNoControlsWarning: true},
  },
};

export const _Badge = () => (
  <div>
    <div>
      Normal <Badge text="0" />
    </div>
    <div>
      New <Badge text="50" priority="new" />
    </div>
  </div>
);

_Badge.parameters = {
  docs: {
    description: {
      story: 'Used to display numbers in a "badge"',
    },
  },
};
