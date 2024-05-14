import Link from 'sentry/components/links/link';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  orgSlug: string;
  projectSlug: string;
  transactionId: string;
  spanId?: string;
}

export function TransactionIdCell({projectSlug, orgSlug, transactionId, spanId}: Props) {
  let url = normalizeUrl(
    `/organizations/${orgSlug}/performance/${projectSlug}:${transactionId}`
  );

  if (spanId) {
    url += `#span-${spanId}`;
  }

  return <Link to={url}>{transactionId.slice(0, 8)}</Link>;
}
