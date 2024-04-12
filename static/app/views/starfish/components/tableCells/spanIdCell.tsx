import Link from 'sentry/components/links/link';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  orgSlug: string;
  projectSlug: string;
  spanId: string;
  transactionId: string;
}

export function SpanIdCell({orgSlug, projectSlug, transactionId, spanId}: Props) {
  const url = normalizeUrl(
    `/organizations/${orgSlug}/performance/${projectSlug}:${transactionId}#span-${spanId}`
  );

  return <Link to={url}>{spanId.slice(0, 16)}</Link>;
}
