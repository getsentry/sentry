import {Location} from 'history';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  sessionId?: string;
};

function Breadcrumb({eventView, sessionId, organization, location}: Props) {
  const crumbs: Crumb[] = [];
  const breadcrumbLandingPageTarget = {
    pathname: `/organizations/${organization.slug}/breadcrumbs/`,
    query: {
      ...location.query,
      ...eventView.generateBlankQueryStringObject(),
      ...eventView.getPageFiltersQuery(),
    },
  };

  crumbs.push({
    to: breadcrumbLandingPageTarget,
    label: t('Breadcrumbs'),
  });

  if (sessionId) {
    crumbs.push({
      label: `Session: ${sessionId}`,
    });
  }

  return <Breadcrumbs crumbs={crumbs} />;
}

export default Breadcrumb;
