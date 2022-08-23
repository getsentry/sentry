import {Location} from 'history';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  userId?: string;
};

function Breadcrumb({eventView, userId, organization, location}: Props) {
  const crumbs: Crumb[] = [];
  const breadcrumbLandingPageTarget = {
    pathname: `/organizations/${organization.slug}/user-journeys/`,
    query: {
      ...location.query,
      ...eventView.generateBlankQueryStringObject(),
      ...eventView.getPageFiltersQuery(),
    },
  };

  crumbs.push({
    to: breadcrumbLandingPageTarget,
    label: t('User Journeys'),
  });

  if (userId) {
    crumbs.push({
      label: `User: ${userId}`,
    });
  }

  return <Breadcrumbs crumbs={crumbs} />;
}

export default Breadcrumb;
