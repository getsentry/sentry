import Badge from 'sentry/components/badge';

export default {
  title: 'Components/Badges/Badge',
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
  </div>
);

_Badge.parameters = {
  docs: {
    description: {
      story: 'Used to display numbers in a "badge"',
    },
  },
};
