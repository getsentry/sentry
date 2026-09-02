import type {Location} from 'history';

import type {LinkProps} from '@sentry/scraps/link';

import type {Crumb} from 'sentry/components/breadcrumbs';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';

import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';

type TabCrumbProps = {
  location: Location;
  organization: Organization;
  transaction?: {
    name: string;
    project: string;
  };
  view?: DomainView;
};

/**
 * A parent crumb of the transaction summary. Labels are plain strings so the
 * same list can feed the legacy `Breadcrumbs` and the typed `BreadcrumbList`.
 */
export interface TransactionSummaryParentCrumb {
  label: string;
  to: LinkProps['to'];
}

/**
 * The crumbs leading up to the transaction summary. Excludes the transaction
 * itself — that is the page title. Only linked crumbs are produced, since an
 * unlinked parent is not worth a slot.
 */
export function getTransactionSummaryParentCrumbs({
  location,
  organization,
  transaction,
  view,
}: TabCrumbProps): TransactionSummaryParentCrumb[] {
  if (!transaction) {
    return [];
  }

  const to = transactionSummaryRouteWithQuery({
    organization,
    transaction: transaction.name,
    projectID: transaction.project,
    query: location.query,
    view,
  });

  return [
    {
      label: t('Transaction Summary'),
      to: {
        ...to,
        // `transactionSummaryRouteWithQuery` forwards most page filters but not
        // `utc`, which would silently reinterpret an absolute range in local
        // time. Merge the selection in the way `preservePageFilters` used to.
        query: {...extractSelectionParameters(location.query), ...to.query},
      },
    },
  ];
}

export const getTabCrumbs = (props: TabCrumbProps): Crumb[] =>
  getTransactionSummaryParentCrumbs(props).map(crumb => ({
    ...crumb,
    preservePageFilters: true,
  }));
