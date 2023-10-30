import {Location} from 'history';
import omit from 'lodash/omit';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  event?: Event;
  isHomepage?: boolean;
};

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
        ? eventView.getResultsViewUrlTarget(organization.slug, isHomepage)
        : discoverTarget,
    label: t('Discover'),
  });

  if (!isHomepage && eventView && eventView.isValid()) {
    crumbs.push({
      to: `/organizations/${organization.slug}/discover/queries/`,
      label: t('Saved Queries'),
    });
    crumbs.push({
      to: eventView.getResultsViewUrlTarget(organization.slug, isHomepage),
      label: eventView.name || '',
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
