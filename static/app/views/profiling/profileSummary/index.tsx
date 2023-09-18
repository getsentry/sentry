import type {Location} from 'history';

import type {PageFilters, Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {LegacySummaryPage} from 'sentry/views/profiling/profileSummary/legacySummaryPage';

interface ProfileSummaryPageProps {
  location: Location;
  params: {
    projectId?: Project['slug'];
  };
  selection: PageFilters;
}

export default function ProfileSummaryPage(props: ProfileSummaryPageProps) {
  const organization = useOrganization();

  if (organization.features.includes('profiling-summary-redesign')) {
    return <div data-test-id="profile-summary-redesign">New Page</div>;
  }

  return (
    <div data-test-id="profile-summary-legacy">
      <LegacySummaryPage {...props} />
    </div>
  );
}
