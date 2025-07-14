import * as qs from 'query-string';

import {Link} from 'sentry/components/core/link';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {generateTransactionSummaryRoute} from 'sentry/views/performance/transactionSummary/utils';

interface Props {
  project?: string;
  transaction?: string;
  transactionMethod?: string;
}

export function TransactionCell({project, transaction, transactionMethod}: Props) {
  const projects = useProjects();
  const organization = useOrganization();
  const location = useLocation();
  const {view} = useDomainViewFilters();

  const projectId = projects.projects.find(p => p.slug === project)?.id;

  const searchQuery = new MutableSearch('');
  if (transactionMethod) {
    searchQuery.addFilterValue('transaction.op', transactionMethod);
  }

  if (!transaction || !projectId) {
    return NULL_DESCRIPTION;
  }

  const pathname = generateTransactionSummaryRoute({
    organization,
    view,
  });

  const query = {
    project: projectId,
    transaction,
    query: searchQuery.formatString(),
    referrer: `insights-${view}-overview`,
    ...location.query,
  };

  return (
    <OverflowEllipsisTextContainer>
      <Link to={`${pathname}/?${qs.stringify(query)}`}>{transaction}</Link>
    </OverflowEllipsisTextContainer>
  );
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;
