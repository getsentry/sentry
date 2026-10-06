import type {Location} from 'history';
import omit from 'lodash/omit';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {EventInputName} from 'sentry/views/discover/eventInputName';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
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

  const discoverTarget = organization.features.includes('discover-query')
    ? {
        pathname: getDiscoverLandingUrl(organization),
        query: {
          ...omit(location.query, 'homepage'),
          ...eventView.generateBlankQueryStringObject(),
          ...eventView.getPageFiltersQuery(),
        },
      }
    : null;

  return (
    <EventInputName
      savedQuery={savedQuery}
      organization={organization}
      eventView={eventView}
    >
      <BreadcrumbList
        items={[
          ...(discoverTarget
            ? [{type: 'link' as const, label: discoverLabel, to: discoverTarget}]
            : []),
          ...(defined(eventView.id)
            ? [
                {
                  type: 'link' as const,
                  label: t('Saved Queries'),
                  to: makeDiscoverPathname({path: '/queries/', organization}),
                },
              ]
            : []),
        ]}
      />
    </EventInputName>
  );
}
