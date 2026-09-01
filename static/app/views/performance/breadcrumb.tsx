import type {Location} from 'history';

import type {Crumb} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {DOMAIN_VIEW_BASE_TITLE} from 'sentry/views/insights/pages/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';

import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';

type Props = {
  location: Location;
  organization: Organization;
  transaction?: {
    name: string;
    project: string;
  };
};

export function getCrumbs(props: Props) {
  const crumbs: Crumb[] = [];
  const {organization, location, transaction} = props;

  if (!organization.features.includes('insights-to-dashboards-ui-rollout')) {
    crumbs.push({
      label: DOMAIN_VIEW_BASE_TITLE,
    });
  }

  crumbs.push(
    ...getTabCrumbs({
      location,
      organization,
      transaction,
    })
  );

  return crumbs;
}

export const getTabCrumbs = ({
  location,
  organization,
  transaction,
  view,
}: {
  location: Location;
  organization: Organization;
  transaction?: {
    name: string;
    project: string;
  };
  view?: DomainView;
}) => {
  const crumbs: Crumb[] = [];

  if (!transaction) {
    return crumbs;
  }

  const routeQuery = {
    organization,
    transaction: transaction.name,
    projectID: transaction.project,
    query: location.query,
    view,
  };

  crumbs.push({
    to: transactionSummaryRouteWithQuery(routeQuery),
    label: t('Transaction Summary'),
    preservePageFilters: true,
  });

  return crumbs;
};
