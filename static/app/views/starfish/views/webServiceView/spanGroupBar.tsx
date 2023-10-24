import {useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import sumBy from 'lodash/sumBy';

import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconPin} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
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

type SpanGroupBarProps = {
  onHover: (string: string | null) => void;
};

export function SpanGroupBar(props: SpanGroupBarProps) {
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const routingContext = useRoutingContext();
  const {onHover} = props;
  const [pinnedModule, setPinnedModule] = useState<string | null>(null);

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
          query: '!span.module:other',
          orderby: '-sum_span_self_time',
          version: 2,
        },
        selection
      ),
      referrer: 'api.starfish-web-service.span-category-breakdown',
      cursor: '',
      limit: 4,
    }
  );
  if (isSegmentsLoading || !segments) {
    return <LoadingIndicator mini />;
  }
  const total = sumBy(segments, 'sum(span.self_time)');
  const debouncedHover = debounce(onHover, DEFAULT_DEBOUNCE_DURATION);
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
            function handleModulePin() {
              if (spanModule === pinnedModule) {
                setPinnedModule(null);
                onHover(null);
              } else {
                setPinnedModule(spanModule);
                onHover(spanModule);
              }
            }
            const tooltipHttp = (
              <div
                onMouseOver={() => pinnedModule === null && debouncedHover(spanModule)}
                onMouseLeave={() => pinnedModule === null && debouncedHover(null)}
                onClick={handleModulePin}
              >
                <div>
                  {tct('Time spent on [spanModule] across all endpoints', {spanModule})}
                </div>
                <IconPin isSolid={spanModule === pinnedModule} /> {percent}%
              </div>
            );
            return (
              <StyledTooltip
                key={index}
                title={tooltipHttp}
                percent={percent}
                isHoverable
              >
                <Segment
                  to={to}
                  hasLink={to !== ''}
                  color={theme.barBreakdownColors[index]}
                  onMouseOver={() => pinnedModule === null && debouncedHover(spanModule)}
                  onMouseLeave={() => pinnedModule === null && debouncedHover(null)}
                >
                  <SegmentText fontColor={theme.barBreakdownFontColors[index]}>
                    {spanModule === pinnedModule && (
                      <StyledIconPin
                        isSolid
                        iconColor={theme.barBreakdownFontColors[index]}
                      />
                    )}
                    {spanModule} {percent}%
                  </SegmentText>
                </Segment>
              </StyledTooltip>
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

const Segment = styled(Link)<{color: string; hasLink: boolean}>`
  border-radius: unset;
  background-color: ${p => p.color};
  text-align: right;
  overflow: hidden;
  direction: rtl;
  width: 100%;
  display: block;
  ${p => !p.hasLink && 'cursor: auto'}
`;

const StyledTooltip = styled(Tooltip)<{percent: number}>`
  width: ${p => p.percent}%;
  min-width: 20px;
`;

const StyledIconPin = styled(IconPin)<{iconColor: string}>`
  color: ${p => p.iconColor};
  padding: 0 ${space(0.25)};
  height: 100%;
`;

const SegmentText = styled('span')<{fontColor: string}>`
  padding: ${space(0.5)};
  color: ${p => p.fontColor};
  white-space: nowrap;
`;
