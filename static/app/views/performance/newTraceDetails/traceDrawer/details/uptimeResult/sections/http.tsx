import {Fragment} from 'react';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {formatBytesBase2} from 'sentry/utils';
import {formatDuration} from 'sentry/utils/duration/formatDuration';
import {
  FoldSection,
  SECTION_NEVER_FOLDS,
} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

function getStatusCodeColor(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) {
    return 'successText';
  }
  if (statusCode >= 300 && statusCode < 400) {
    return 'warningText';
  }
  if (statusCode >= 400) {
    return 'errorText';
  }
  return 'subText';
}

export function UptimeHTTPInfo({node}: {node: TraceTreeNode<TraceTree.EAPUptimeResult>}) {
  const uptimeResult = node.value;

  const items: TraceDrawerComponents.KeyValueListItem[] = [];

  if (uptimeResult.request_url) {
    items.push({
      key: 'url',
      subject: t('URL'),
      value: (
        <Fragment>
          <ExternalLink href={uptimeResult.request_url}>
            {uptimeResult.request_url}
          </ExternalLink>
          <CopyToClipboardButton
            text={uptimeResult.request_url}
            size="zero"
            iconSize="xs"
            borderless
          />
        </Fragment>
      ),
    });
  }

  if (uptimeResult.request_type) {
    items.push({
      key: 'method',
      subject: t('Method'),
      value: uptimeResult.request_type,
    });
  }

  if (uptimeResult.http_status_code) {
    items.push({
      key: 'status_code',
      subject: t('Status Code'),
      value: (
        <span
          style={{color: `var(--${getStatusCodeColor(uptimeResult.http_status_code)})`}}
        >
          {uptimeResult.http_status_code}
        </span>
      ),
    });
  }

  if (uptimeResult.request_duration_us) {
    items.push({
      key: 'request_duration',
      subject: t('Request Duration'),
      value: formatDuration(uptimeResult.request_duration_us / 1000), // Convert microseconds to milliseconds
    });
  }

  if (uptimeResult.response_content_length) {
    items.push({
      key: 'content_length',
      subject: t('Content Length'),
      value: formatBytesBase2(uptimeResult.response_content_length),
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <FoldSection sectionKey="http-info" foldThreshold={SECTION_NEVER_FOLDS}>
      <TraceDrawerComponents.SectionCard>
        <TraceDrawerComponents.SectionCardHeader>
          <TraceDrawerComponents.Title>{t('HTTP Request')}</TraceDrawerComponents.Title>
        </TraceDrawerComponents.SectionCardHeader>
        <TraceDrawerComponents.KeyValueList data={items} />
      </TraceDrawerComponents.SectionCard>
    </FoldSection>
  );
}
