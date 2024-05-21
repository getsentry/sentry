import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';

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
