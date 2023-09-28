import styled from '@emotion/styled';
import sumBy from 'lodash/sumBy';

import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import theme from 'sentry/utils/theme';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

const {SPAN_SELF_TIME} = SpanMetricsField;

function getPercent(value, total) {
  return Math.round((value['sum(span.self_time)'] / total) * 100 * 100) / 100;
}

export function SpanGroupBar() {
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const routingContext = useRoutingContext();

  type SegmentResponse = {
    'span.module': string;
    'sum(span.self_time)': number;
  };
  const {data: segments, isLoading: isSegmentsLoading} = useSpansQuery<SegmentResponse[]>(
    {
      eventView: EventView.fromNewQueryWithPageFilters(
        {
          name: '',
          fields: [`sum(${SPAN_SELF_TIME})`, 'span.module'],
          dataset: DiscoverDatasets.SPANS_METRICS,
          orderby: '-sum_span_self_time',
          version: 2,
        },
        selection
      ),
      referrer: 'api.starfish-web-service.span-category-breakdown',
      limit: 4,
    }
  );
  if (isSegmentsLoading || !segments) {
    return <LoadingIndicator mini />;
  }
  const total = sumBy(segments, 'sum(span.self_time)');
  return (
    <FlexibleRowPanel>
      <Title>{t('Time Spent Breakdown')}</Title>
      <SegmentContainer>
        {segments &&
          segments.map((value, index) => {
            const percent = getPercent(value, total);
            const spanModule = value['span.module'];
            const to =
              spanModule === 'db'
                ? `/${routingContext.baseURL}/performance/database/`
                : '';
            return (
              <Segment
                to={to}
                key={index}
                style={{width: percent + '%'}}
                color={theme.barBreakdownColors[index]}
              >
                <Tooltip title={`${spanModule} ${percent}%`}>
                  <SegmentText fontColor={theme.barBreakdownFontColors[index]}>
                    {spanModule} {percent}%
                  </SegmentText>
                </Tooltip>
              </Segment>
            );
          })}
      </SegmentContainer>
    </FlexibleRowPanel>
  );
}

const FlexibleRowPanel = styled(Panel)`
  display: flex;
  flex-direction: row;
`;

const Title = styled('div')`
  flex: 1;
  margin: auto;
  padding-left: ${space(2)};
  ${p => p.theme.text.cardTitle}
`;

const SegmentContainer = styled('div')`
  flex: 4;
  display: flex;
  padding: ${space(1)};
`;

const Segment = styled(Link)<{color: string}>`
  border-radius: unset;
  background-color: ${p => p.color};
  text-align: right;
  overflow: hidden;
  direction: rtl;
`;

const SegmentText = styled('span')<{fontColor: string}>`
  padding: ${space(0.5)};
  color: ${p => p.fontColor};
  white-space: nowrap;
`;
