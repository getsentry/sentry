import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';

interface Props {
  project?: string;
  transaction?: string;
  transactionMethod?: string;
}

export function TransactionCell({project, transaction}: Props) {
  const moduleURL = useModuleURL('cache');
  const location = useLocation();

  if (!transaction) {
    return NULL_DESCRIPTION;
  }

  const query = {
    ...location.query,
    transaction,
    project,
  };

  return (
    <OverflowEllipsisTextContainer>
      <Link to={`${moduleURL}/?${qs.stringify(query)}`}>{transaction}</Link>
    </OverflowEllipsisTextContainer>
  );
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;
