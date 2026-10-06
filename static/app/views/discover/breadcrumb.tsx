import type {Location} from 'history';

import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import type {EventView} from 'sentry/utils/discover/eventView';
import {EventInputName} from 'sentry/views/discover/eventInputName';
import {TopBar} from 'sentry/views/navigation/topBar';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  savedQuery?: SavedQuery;
};

export function DiscoverBreadcrumb({
  eventView,
  organization,
  location,
  savedQuery,
}: Props) {
  const discoverLabel = t('Errors');

  // Without a query to name, Discover itself is the current page, so there is
  // no trail above it.
  if (!eventView?.isValid()) {
    return (
      <TopBar.Slot
        name="breadcrumbs"
        title={{type: 'page-title', label: discoverLabel}}
      />
    );
  }

  return (
    <EventInputName
      savedQuery={savedQuery}
      organization={organization}
      eventView={eventView}
      location={location}
    />
  );
}
