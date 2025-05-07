import useOrganization from 'sentry/utils/useOrganization';
import type {Release} from 'sentry/views/dashboards/widgets/common/types';

export function useReleaseBubbleProps(releases: Release[] | undefined) {
  const organization = useOrganization();
  return organization.features.includes('release-bubbles-ui')
    ? ({releases, showReleaseAs: 'bubble'} as const)
    : {};
}
