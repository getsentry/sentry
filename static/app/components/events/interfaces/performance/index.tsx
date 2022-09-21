import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import keyBy from 'lodash/keyBy';

import {t} from 'sentry/locale';
import {
  EntryType,
  EventTransaction,
  IssueCategory,
  KeyValueListData,
  Organization,
} from 'sentry/types';

import DataSection from '../../eventTagsAndScreenshot/dataSection';
import KeyValueList from '../keyValueList';
import TraceView from '../spans/traceView';
import {RawSpanType, SpanEntry} from '../spans/types';
import WaterfallModel from '../spans/waterfallModel';

interface Props {
  event: EventTransaction;
  organization: Organization;
}

export function SpanEvidenceSection({event, organization}: Props) {
  if (!event.perfProblem) {
    if (
      event.issueCategory === IssueCategory.PERFORMANCE &&
      event.endTimestamp > 1663560000 //  (Sep 19, 2022 onward), Some events could have been missing evidence before EA
    ) {
      Sentry.captureException(new Error('Span Evidence missing for performance issue.'));
    }
    return null;
  }

  // Let's dive into the event to pick off the span evidence data by using the IDs we know
  const spanEntry = event.entries.find((entry: SpanEntry | any): entry is SpanEntry => {
    return entry.type === EntryType.SPANS;
  });
  const spans: Array<RawSpanType> = spanEntry?.data ?? [];
  const spansById = keyBy(spans, 'span_id');

  const parentSpan = spansById[event.perfProblem.parentSpanIds[0]];
  const sourceSpan = spansById[event.perfProblem.causeSpanIds[0]];
  const repeatingSpan = spansById[event.perfProblem.offenderSpanIds[0]];

  const data: KeyValueListData = [
    {
      key: '0',
      subject: t('Transaction'),
      value: event.title,
    },
    {
      key: '1',
      subject: t('Parent Span'),
      value: getSpanEvidenceValue(parentSpan),
    },
    {
      key: '2',
      subject: t('Source Span'),
      value: getSpanEvidenceValue(sourceSpan),
    },
    {
      key: '3',
      subject: t('Repeating Span'),
      value: getSpanEvidenceValue(repeatingSpan),
    },
  ];

  const affectedSpanIds = [
    parentSpan.span_id,
    sourceSpan.span_id,
    ...event.perfProblem.offenderSpanIds,
  ];

  return (
    <DataSection
      title={t('Span Evidence')}
      description={t(
        'Span Evidence identifies the parent span where the N+1 occurs, the source span that occurs immediately before the repeating spans, and the repeating span itself.'
      )}
    >
      <KeyValueList data={data} />

      <TraceViewWrapper>
        <TraceView
          organization={organization}
          waterfallModel={new WaterfallModel(event as EventTransaction, affectedSpanIds)}
          isEmbedded
        />
      </TraceViewWrapper>
    </DataSection>
  );
}

function getSpanEvidenceValue(span: RawSpanType) {
  if (!span.op && !span.description) {
    return t('(no value)');
  }

  if (!span.op && span.description) {
    return span.description;
  }

  if (span.op && !span.description) {
    return span.op;
  }

  return `${span.op} - ${span.description}`;
}

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
