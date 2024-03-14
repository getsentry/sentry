import {Link} from 'react-router';
import * as qs from 'query-string';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';

interface Props {
  domain?: string;
  transaction?: string;
  transactionMethod?: string;
}

export function TransactionCell({domain, transaction, transactionMethod}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  if (!domain || !transaction) {
    return NULL_DESCRIPTION;
  }

  // TODO: This checks if the transaction name starts with the request method so we don't end up with labels like `GET GET /users` but any transaction name with an HTTP method prefix is incorrect, so it's not clear that we should cater to this
  const label =
    transactionMethod && !transaction.startsWith(transactionMethod)
      ? `${transactionMethod} ${transaction}`
      : transaction;

  const pathname = normalizeUrl(
    `/organizations/${organization.slug}/performance/http/domains/`
  );

  const query = {
    ...location.query,
    domain,
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
