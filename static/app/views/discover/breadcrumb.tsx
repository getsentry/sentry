import {Fragment} from 'react';
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
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';
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
  const discoverLabel = getDiscoverDeprecation(organization)
    ? t('Errors')
    : t('Discover');

  // Without a query to name, Discover itself is the current page, so there is
  // no trail above it.
  if (!eventView?.isValid()) {
    return (
      <TopBar.Slot name="title">
        <BreadcrumbList.Title item={{type: 'page-title', label: discoverLabel}} />
      </TopBar.Slot>
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
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
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
      </TopBar.Slot>

      <TopBar.Slot name="title">
        <EventInputName
          savedQuery={savedQuery}
          organization={organization}
          eventView={eventView}
        />
      </TopBar.Slot>
    </Fragment>
  );
}
