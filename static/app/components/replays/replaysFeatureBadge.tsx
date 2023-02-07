import FeatureBadge from 'sentry/components/featureBadge';
import useOrganization from 'sentry/utils/useOrganization';

function ReplaysFeatureBadge(
  props: Omit<React.ComponentProps<typeof FeatureBadge>, 'type'>
) {
  // TODO(replay): Remove this special-case for our internal demo org
  const organization = useOrganization();
  if (organization.slug === 'testorg-az') {
    return null;
  }
  return <FeatureBadge {...props} type="beta" />;
}

export default ReplaysFeatureBadge;
