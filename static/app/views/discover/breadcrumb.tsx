import type {Location} from 'history';
import omit from 'lodash/omit';

import type {Crumb} from 'sentry/components/breadcrumbs';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {EventInputName} from 'sentry/views/discover/eventInputName';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  isHomepage?: boolean;
  savedQuery?: SavedQuery;
};

export function DiscoverBreadcrumb({
  eventView,
  organization,
  location,
  isHomepage,
  savedQuery,
}: Props) {
  const crumbs: Crumb[] = [];
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

  crumbs.push({
    to:
      isHomepage && eventView
        ? eventView.getResultsViewUrlTarget(organization, isHomepage)
        : discoverTarget,
    label: getDiscoverDeprecation(organization) ? t('Errors') : t('Discover'),
  });

  if (!isHomepage && eventView?.isValid()) {
    if (defined(eventView.id)) {
      crumbs.push({
        to: makeDiscoverPathname({
          path: '/queries/',
          organization,
        }),
        label: t('Saved Queries'),
      });
    }
    crumbs.push({
      to: undefined,
      label: (
        <EventInputName
          savedQuery={savedQuery}
          organization={organization}
          eventView={eventView}
          isHomepage={isHomepage}
        />
      ),
    });
  }

  return <Breadcrumbs crumbs={crumbs} />;
}
