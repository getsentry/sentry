import {Fragment} from 'react';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {formatDuration} from 'sentry/utils/duration/formatDuration';
import {
  FoldSection,
  SECTION_NEVER_FOLDS,
} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {StatusBadge} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/uptimeResult/index';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

export function GeneralInfo({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.EAPUptimeResult>;
  organization: Organization;
}) {
  const uptimeResult = node.value;

  const items: TraceDrawerComponents.KeyValueListItem[] = [
    {
      key: 'status',
      subject: t('Check Status'),
      value: (
        <StatusBadge status={uptimeResult.check_status}>
          {uptimeResult.check_status}
        </StatusBadge>
      ),
    },
    {
      key: 'region',
      subject: t('Region'),
      value: uptimeResult.region,
    },
    {
      key: 'subscription_id',
      subject: t('Subscription ID'),
      value: (
        <Fragment>
          {uptimeResult.subscription_id}
          <CopyToClipboardButton
            text={uptimeResult.subscription_id}
            size="zero"
            iconSize="xs"
            borderless
          />
        </Fragment>
      ),
    },
    {
      key: 'check_duration',
      subject: t('Check Duration'),
      value: formatDuration(uptimeResult.check_duration_us / 1000), // Convert microseconds to milliseconds
    },
  ];

  // Add status reason if this was a failure
  if (uptimeResult.check_status === 'failure' && uptimeResult.status_reason_type) {
    items.push({
      key: 'status_reason_type',
      subject: t('Failure Type'),
      value: uptimeResult.status_reason_type,
    });

    if (uptimeResult.status_reason_description) {
      items.push({
        key: 'status_reason_description',
        subject: t('Failure Description'),
        value: uptimeResult.status_reason_description,
      });
    }
  }

  // Add trace context if available
  if (uptimeResult.trace_id) {
    items.push({
      key: 'trace_id',
      subject: t('Trace ID'),
      value: (
        <Fragment>
          <Link
            to={`/organizations/${organization.slug}/performance/trace/${uptimeResult.trace_id}/`}
          >
            {uptimeResult.trace_id}
          </Link>
          <CopyToClipboardButton
            text={uptimeResult.trace_id}
            size="zero"
            iconSize="xs"
            borderless
          />
        </Fragment>
      ),
    });
  }

  if (uptimeResult.span_id) {
    items.push({
      key: 'span_id',
      subject: t('Span ID'),
      value: (
        <Fragment>
          {uptimeResult.span_id}
          <CopyToClipboardButton
            text={uptimeResult.span_id}
            size="zero"
            iconSize="xs"
            borderless
          />
        </Fragment>
      ),
    });
  }

  // Add redirect sequence info if applicable
  if (uptimeResult.request_sequence !== undefined && uptimeResult.request_sequence > 0) {
    items.push({
      key: 'request_sequence',
      subject: t('Request Sequence'),
      value: `${uptimeResult.request_sequence} (redirect follow-up)`,
    });
  }

  return (
    <FoldSection sectionKey="general-info" foldThreshold={SECTION_NEVER_FOLDS}>
      <TraceDrawerComponents.SectionCard>
        <TraceDrawerComponents.SectionCardHeader>
          <TraceDrawerComponents.Title>{t('General')}</TraceDrawerComponents.Title>
        </TraceDrawerComponents.SectionCardHeader>
        <TraceDrawerComponents.KeyValueList data={items} />
      </TraceDrawerComponents.SectionCard>
    </FoldSection>
  );
}
