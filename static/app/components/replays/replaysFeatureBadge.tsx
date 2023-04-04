import FeatureBadge from 'sentry/components/featureBadge';

const ReplaysFeatureBadge = (
  props: Omit<React.ComponentProps<typeof FeatureBadge>, 'type'>
) => {
  return <FeatureBadge {...props} type="new" />;
};

export default ReplaysFeatureBadge;
