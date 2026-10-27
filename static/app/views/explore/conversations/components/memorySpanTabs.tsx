import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {
  EmptySpanTab,
  SPAN_TAB_JSON_AUTO_COLLAPSE_LIMIT,
  SPAN_TAB_JSON_MAX_DEFAULT_DEPTH,
  SpanTabContent,
} from 'sentry/views/explore/conversations/components/spanTabContent';
import {
  formatMemoryScore,
  getMemoryResultText,
  type Memory,
  type MemoryRecord,
  MemoryOperation,
} from 'sentry/views/insights/pages/agents/utils/memory';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';

export function MemoryInputTab({memory}: {memory: Memory}) {
  switch (memory.operation) {
    case MemoryOperation.SEARCH:
      return memory.query ? (
        <Section title={t('Query')}>
          <SpanTabContent content={memory.query} />
        </Section>
      ) : (
        <EmptySpanTab message={t('The search query was not captured')} />
      );
    case MemoryOperation.DELETE:
      // A specific record id, or a count of one, is a targeted delete already
      // summarized in the header. Only a delete with no record scope is the
      // store-wide case; an absent id alone can just mean it wasn't captured.
      return memory.recordId || memory.recordCount === 1 ? (
        <EmptySpanTab message={t('No input for this span')} />
      ) : (
        <Section title={t('Target')}>
          <Text as="div">{t('All records in the store')}</Text>
        </Section>
      );
    case MemoryOperation.CREATE_STORE:
    case MemoryOperation.DELETE_STORE:
      // The store is shown in the header, so there's no separate input.
      return <EmptySpanTab message={t('No input for this span')} />;
    default:
      return (
        <MemoryRecordsSection
          title={t('Records')}
          memory={memory}
          emptyMessage={t('No records to display')}
        />
      );
  }
}

export function MemoryOutputTab({memory}: {memory: Memory}) {
  switch (memory.operation) {
    case MemoryOperation.SEARCH:
      return (
        <MemoryRecordsSection
          title={t('Results')}
          memory={memory}
          showScore
          emptyMessage={t('No matching records were returned')}
        />
      );
    case MemoryOperation.CREATE_STORE:
    case MemoryOperation.DELETE_STORE:
      return <EmptySpanTab message={t('No output for this span')} />;
    default: {
      const result = getMemoryResultText(memory);
      return result ? (
        <Section title={t('Result')}>
          <Text as="div">{result}</Text>
        </Section>
      ) : (
        <EmptySpanTab message={t('No output for this span')} />
      );
    }
  }
}

function MemoryRecordsSection({
  title,
  memory,
  showScore,
  emptyMessage,
}: {
  emptyMessage: string;
  memory: Memory;
  title: string;
  showScore?: boolean;
}) {
  const {records, rawRecords, recordCount} = memory;

  if (records && records.length > 0) {
    const ordered = showScore
      ? [...records].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
      : records;

    return (
      <Section title={title}>
        <Stack gap="xl">
          {ordered.map((record, index) => (
            <MemoryRecordItem
              key={record.id ?? index}
              record={record}
              showScore={showScore}
            />
          ))}
        </Stack>
      </Section>
    );
  }

  // Present but unparseable: show it raw rather than dropping it.
  if (!records && rawRecords) {
    return (
      <Section title={title}>
        <TraceDrawerComponents.MultilineJSON value={rawRecords} mode="raw" />
      </Section>
    );
  }

  // A positive count with no renderable records means the content wasn't
  // captured (records are opt-in, or an empty array disagrees with the count);
  // showing "none" here would contradict the count in the header.
  if ((recordCount ?? 0) > 0) {
    return <EmptySpanTab message={t('Record content was not captured')} />;
  }

  return <EmptySpanTab message={emptyMessage} />;
}

function MemoryRecordItem({
  record,
  showScore,
}: {
  record: MemoryRecord;
  showScore?: boolean;
}) {
  const hasHeader = (showScore && record.score !== undefined) || Boolean(record.id);

  return (
    <Stack gap="sm">
      {hasHeader ? (
        <Flex gap="sm" align="center" wrap="wrap">
          {showScore && record.score !== undefined ? (
            <Tooltip title={t('Relevance score')}>
              <Tag variant="info">{t('Score %s', formatMemoryScore(record.score))}</Tag>
            </Tooltip>
          ) : null}
          {record.id ? (
            <Text size="sm" variant="muted" monospace ellipsis>
              {record.id}
            </Text>
          ) : null}
        </Flex>
      ) : null}
      <SpanTabContent content={record.content} />
      {record.metadata === undefined || record.metadata === null ? null : (
        <TraceDrawerComponents.MultilineJSON
          value={record.metadata}
          maxDefaultDepth={SPAN_TAB_JSON_MAX_DEFAULT_DEPTH}
          autoCollapseLimit={SPAN_TAB_JSON_AUTO_COLLAPSE_LIMIT}
        />
      )}
    </Stack>
  );
}

function Section({title, children}: {children: React.ReactNode; title: string}) {
  return (
    <Stack gap="md">
      <Text bold>{title}</Text>
      {children}
    </Stack>
  );
}
