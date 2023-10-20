import {useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {DataSection} from 'sentry/components/events/styles';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import PieChart from './pieChart';

const SPAN_OPS = ['db', 'http', 'resource', 'browser', 'ui'];
const REQUEST_FIELDS = SPAN_OPS.map(op => ({field: `p100(spans.${op})`}));
const SPAN_OPS_NAME_MAP = {
  ['p100(spans.db)']: 'db',
  ['p100(spans.http)']: 'http',
  ['p100(spans.resource)']: 'resource',
  ['p100(spans.browser)']: 'browser',
  ['p100(spans.ui)']: 'ui',
};

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

function EventSpanOpBreakdown({event}: {event: Event}) {
  const organization = useOrganization();
  const location = useLocation();
  const now = useMemo(() => Date.now(), []);

  const postBreakpointEventView = getPostBreakpointEventView(location, event, now);
  const preBreakpointEventView = getPreBreakpointEventView(location, event);

  const queryExtras = {dataset: 'metricsEnhanced'};

  const {
    data: postBreakpointData,
    isLoading: postBreakpointIsLoading,
    isError: postBreakpointIsError,
  } = useDiscoverQuery({
    eventView: postBreakpointEventView,
    orgSlug: organization.slug,
    location,
    queryExtras,
  });

  const {
    data: preBreakpointData,
    isLoading: preBreakpointIsLoading,
    isError: preBreakpointIsError,
  } = useDiscoverQuery({
    eventView: preBreakpointEventView,
    orgSlug: organization.slug,
    location,
    queryExtras,
  });

  const postBreakpointPrunedSpanOps = Object.entries(postBreakpointData?.data[0] || {})
    .filter(entry => (entry[1] as number) > 0)
    .map(entry => ({
      value: entry[1] as number,
      name: SPAN_OPS_NAME_MAP[entry[0]],
    }));

  const spanOpDiffs = SPAN_OPS.map(op => {
    const preBreakpointValue =
      (preBreakpointData?.data[0][`p100(spans.${op})`] as string) || undefined;
    const preBreakpointValueAsNumber = preBreakpointValue
      ? parseInt(preBreakpointValue, 10)
      : 0;

    const postBreakpointValue =
      (postBreakpointData?.data[0][`p100(spans.${op})`] as string) || undefined;
    const postBreakpointValueAsNumber = postBreakpointValue
      ? parseInt(postBreakpointValue, 10)
      : 0;

    if (preBreakpointValueAsNumber === 0 || postBreakpointValueAsNumber === 0) {
      return null;
    }
    return {
      [op]: {
        percentChange: postBreakpointValueAsNumber / preBreakpointValueAsNumber,
        oldBaseline: preBreakpointValueAsNumber,
        newBaseline: postBreakpointValueAsNumber,
      },
    };
  })
    .filter(Boolean)
    .reduce((acc, opDiffData) => {
      if (opDiffData && acc) {
        Object.keys(opDiffData).forEach(op => {
          acc[op] = opDiffData[op];
        });
      }
      return acc;
    }, {});

  const series = [
    {
      seriesName: 'Aggregate Span Op Breakdown',
      data: postBreakpointPrunedSpanOps,
    },
  ];

  if (postBreakpointIsLoading || preBreakpointIsLoading) {
    return (
      <Wrapper>
        <LoadingIndicator />
      </Wrapper>
    );
  }

  if (postBreakpointIsError || preBreakpointIsError) {
    return (
      <Wrapper>
        <EmptyStateWrapper>
          <EmptyStateWarning withIcon>
            <div>{t('Unable to fetch span breakdowns')}</div>
          </EmptyStateWarning>
        </EmptyStateWrapper>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <DataSection>
        <TitleWrapper>
          <strong>{t('Operation Breakdown')}</strong>
          <QuestionTooltip
            title={t(
              'Percentage of total transaction duration spent on each span operation along with, changes in the total duration of each span operation.'
            )}
            size="sm"
          />
        </TitleWrapper>
        <PieChart data={spanOpDiffs} series={series} />
      </DataSection>
    </Wrapper>
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

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

export default EventSpanOpBreakdown;
