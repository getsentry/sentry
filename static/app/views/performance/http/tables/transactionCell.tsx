import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useRequestsModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {ModuleName} from 'sentry/views/starfish/types';

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
  const moduleURL = useRequestsModuleURL();
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
      <Link
        onClick={() =>
          trackAnalytics('performance_views.sample_spans.opened', {
            organization,
            source: ModuleName.HTTP,
          })
        }
        to={`${pathname}?${qs.stringify(query)}`}
      >
        {label}
      </Link>
    </OverflowEllipsisTextContainer>
  );
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;
