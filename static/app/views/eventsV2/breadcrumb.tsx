import {Location} from 'history';
import omit from 'lodash/omit';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {getDiscoverLandingUrl, getDiscoverQueriesUrl} from 'sentry/utils/discover/urls';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  event?: Event;
  isHomepage?: boolean;
};

const HOMEPAGE_DEFAULT_LABEL = t('New Query');

function DiscoverBreadcrumb({
  eventView,
  event,
  organization,
  location,
  isHomepage,
}: Props) {
  const crumbs: Crumb[] = [];
  const discoverTarget = organization.features.includes('discover-query')
    ? {
        pathname: organization.features.includes('discover-query-builder-as-landing-page')
          ? getDiscoverQueriesUrl(organization)
          : getDiscoverLandingUrl(organization),
        query: {
          ...omit(location.query, 'homepage'),
          ...eventView.generateBlankQueryStringObject(),
          ...eventView.getPageFiltersQuery(),
        },
      }
    : null;

  crumbs.push({
    to: discoverTarget,
    label: t('Discover'),
  });

  if (eventView && eventView.isValid()) {
    crumbs.push({
      to: eventView.getResultsViewUrlTarget(organization.slug, isHomepage),
      label: isHomepage ? HOMEPAGE_DEFAULT_LABEL : eventView.name || '',
    });
  }

  if (event) {
    crumbs.push({
      label: t('Event Detail'),
    });
  }

  return <Breadcrumbs crumbs={crumbs} />;
}

export default DiscoverBreadcrumb;
