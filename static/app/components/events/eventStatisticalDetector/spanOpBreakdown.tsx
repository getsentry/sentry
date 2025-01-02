import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import moment from 'moment-timezone';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {DataSection} from 'sentry/components/events/styles';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {NumericChange, renderHeadCell} from 'sentry/utils/performance/regression/table';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const SPAN_OPS = ['db', 'http', 'resource', 'browser', 'ui'];
const REQUEST_FIELDS = SPAN_OPS.map(op => ({field: `p95(spans.${op})`}));

interface SpanOpDiff {
  p95: {
    newBaseline: number;
    oldBaseline: number;
  };
  span_op: string;
}

function getPostBreakpointEventView(location: Location, event: Event, end: number) {
  const eventView = EventView.fromLocation(location);
  eventView.fields = REQUEST_FIELDS;

  if (event?.occurrence) {
    const {breakpoint, aggregateRange2, transaction} = event?.occurrence?.evidenceData;
    eventView.start = new Date(breakpoint * 1000).toISOString();
    eventView.end = new Date(end).toISOString();

    eventView.query = `event.type:transaction transaction:"${transaction}" transaction.duration:<${
      aggregateRange2 * 1.15
    }`;
  }

  return eventView;
}

function getPreBreakpointEventView(location: Location, event: Event) {
  const retentionPeriodMs = moment().subtract(90, 'days').valueOf();
  const eventView = EventView.fromLocation(location);
  eventView.fields = REQUEST_FIELDS;

  if (event?.occurrence) {
    const {breakpoint, aggregateRange1, transaction, dataStart} =
      event?.occurrence?.evidenceData;
    eventView.start = new Date(
      Math.max(dataStart * 1000, retentionPeriodMs)
    ).toISOString();
    eventView.end = new Date(breakpoint * 1000).toISOString();

    eventView.query = `event.type:transaction transaction:"${transaction}" transaction.duration:<${
      aggregateRange1 * 1.15
    }`;
  }

  return eventView;
}

function renderBodyCell({
  column,
  row,
}: {
  column: GridColumnOrder<string>;
  row: SpanOpDiff;
}) {
  if (column.key === 'p95') {
    const {oldBaseline, newBaseline} = row[column.key];
    return (
      <NumericChange
        beforeRawValue={oldBaseline}
        afterRawValue={newBaseline}
        columnKey={column.key}
      />
    );
  }
  return row[column.key];
}

function EventSpanOpBreakdown({event}: {event: Event}) {
  const organization = useOrganization();
  const location = useLocation();
  const now = useMemo(() => Date.now(), []);

  const postBreakpointEventView = getPostBreakpointEventView(location, event, now);
  const preBreakpointEventView = getPreBreakpointEventView(location, event);

  const queryExtras = {dataset: 'metricsEnhanced'};

  const {
    data: postBreakpointData,
    isPending: postBreakpointIsLoading,
    isError: postBreakpointIsError,
  } = useDiscoverQuery({
    eventView: postBreakpointEventView,
    orgSlug: organization.slug,
    location,
    queryExtras,
  });

  const {
    data: preBreakpointData,
    isPending: preBreakpointIsLoading,
    isError: preBreakpointIsError,
  } = useDiscoverQuery({
    eventView: preBreakpointEventView,
    orgSlug: organization.slug,
    location,
    queryExtras,
  });

  const spanOpDiffs: SpanOpDiff[] = SPAN_OPS.map(op => {
    const preBreakpointValue =
      (preBreakpointData?.data[0]![`p95(spans.${op})`] as string) || undefined;
    const preBreakpointValueAsNumber = preBreakpointValue
      ? parseInt(preBreakpointValue, 10)
      : 0;

    const postBreakpointValue =
      (postBreakpointData?.data[0]![`p95(spans.${op})`] as string) || undefined;
    const postBreakpointValueAsNumber = postBreakpointValue
      ? parseInt(postBreakpointValue, 10)
      : 0;

    if (preBreakpointValueAsNumber === 0 || postBreakpointValueAsNumber === 0) {
      return null;
    }
    return {
      span_op: op,
      p95: {
        oldBaseline: preBreakpointValueAsNumber,
        newBaseline: postBreakpointValueAsNumber,
      },
    };
  }).filter(defined);

  if (postBreakpointIsLoading || preBreakpointIsLoading) {
    return <LoadingIndicator />;
  }

  if (postBreakpointIsError || preBreakpointIsError) {
    return (
      <EmptyStateWrapper>
        <EmptyStateWarning withIcon>
          <div>{t('Unable to fetch span breakdowns')}</div>
        </EmptyStateWarning>
      </EmptyStateWrapper>
    );
  }

  return (
    <DataSection>
      <strong>{t('Operation Breakdown:')}</strong>
      <GridEditable
        isLoading={false}
        data={spanOpDiffs}
        columnOrder={[
          {key: 'span_op', name: t('Span Operation'), width: 200},
          {key: 'p95', name: t('p95'), width: COL_WIDTH_UNDEFINED},
        ]}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell: (column, row) => renderBodyCell({column, row}),
        }}
      />
    </DataSection>
  );
}

const EmptyStateWrapper = styled('div')`
  border: ${({theme}) => `1px solid ${theme.border}`};
  border-radius: ${({theme}) => theme.borderRadius};
  display: flex;
  justify-content: center;
  align-items: center;
  margin: ${space(1.5)} ${space(4)};
`;

export default EventSpanOpBreakdown;
