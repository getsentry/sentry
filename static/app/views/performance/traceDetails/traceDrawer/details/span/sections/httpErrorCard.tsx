import {IconWarning} from '@sentry/icons/warning';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {HTTP_ERROR_STATUSES} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/constants';
import type {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';

import {SpanErrorCard} from './spanErrorCard';

type HttpErrorCardProps = {
  node: EapSpanNode;
};

function formatStatusText(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getStatusInfo(node: EapSpanNode): {
  statusCode: number | null;
  statusText: string | null;
} {
  const status = node.attributes?.['span.status'];
  const statusText =
    typeof status === 'string' && HTTP_ERROR_STATUSES.has(status)
      ? formatStatusText(status)
      : null;
  const raw = Number(node.attributes?.['http.response.status_code']);
  const statusCode = !isNaN(raw) && raw >= 400 ? raw : null;
  return {statusText, statusCode};
}

export function HttpErrorCard({node}: HttpErrorCardProps) {
  if (!node.hasHttpError) {
    return null;
  }

  const {statusText, statusCode} = getStatusInfo(node);

  return (
    <SpanErrorCard
      icon={<IconWarning size="md" variant="warning" />}
      title={
        <Flex gap="xs" align="center">
          <Text bold>{statusText ?? t('HTTP Error')}</Text>
          {statusCode !== null && <Text variant="muted">{t('HTTP %s', statusCode)}</Text>}
        </Flex>
      }
      message={
        <Text size="sm" variant="muted">
          {t('This span returned an error status but has no associated issue.')}
        </Text>
      }
    />
  );
}
