import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';

interface Props {
  domain?: string;
  project?: string;
  transaction?: string;
  transactionMethod?: string;
}

export function TransactionCell({
  domain,
  project,
  transaction,
  transactionMethod,
}: Props) {
  const moduleURL = useModuleURL('http');
  const location = useLocation();

  if (!transaction) {
    return NULL_DESCRIPTION;
  }

  // TODO: This checks if the transaction name starts with the request method so we don't end up with labels like `GET GET /users` but any transaction name with an HTTP method prefix is incorrect, so it's not clear that we should cater to this
  const label =
    transactionMethod && !transaction.startsWith(transactionMethod)
      ? `${transactionMethod} ${transaction}`
      : transaction;

  const pathname = `${moduleURL}/domains/`;

  const query = {
    ...location.query,
    domain,
    project,
    transaction,
    transactionMethod,
  };

  return (
    <OverflowEllipsisTextContainer>
      <Link to={`${pathname}?${qs.stringify(query)}`}>{label}</Link>
    </OverflowEllipsisTextContainer>
  );
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;
