import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPin} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';

const {SPAN_SELF_TIME} = SpanMetricsField;
const COLORS = ['#EAE2F8', '#BBA6DF', '#9A81C4', '#694D99', '#402A65'];
const FONT_COLORS = ['#564277', '#e8e2f1', '#e8e2f1', '#e8e2f1', '#e8e2f1'];

function getPercent(value, total) {
  return Math.round((value['sum(span.self_time)'] / total) * 100 * 100) / 100;
}

type SpanGroupBarProps = {
  onHover: (string) => void;
};

export function SpanGroupBar(props: SpanGroupBarProps) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {selection} = pageFilter;
  const organization = useOrganization();
  const routingContext = useRoutingContext();
  const {onHover} = props;
  const [pinnedModule, setPinnedModule] = useState<string | null>(null);

  const {data: segments, isLoading: isSegmentsLoading} = useDiscoverQuery({
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
    orgSlug: organization.slug,
    referrer: 'api.starfish-web-service.span-category-breakdown',
    location,
    limit: 4,
  });
  if (isSegmentsLoading || !segments) {
    return <Fragment />;
  }
  let total = 0;
  segments.data.map(
    value => (total += parseFloat(value['sum(span.self_time)'] as string))
  );
  return (
    <StyledPanel>
      <Title>Time Spent Breakdown</Title>
      <SegmentContainer>
        {segments &&
          segments.data.map((value, index) => {
            const percent = getPercent(value, total);
            const spanModule = value['span.module'];
            const to =
              spanModule === 'db'
                ? `/${routingContext.baseURL}/performance/database`
                : '';
            function handleModulePin() {
              if (spanModule === pinnedModule) {
                setPinnedModule(null);
                onHover(null);
              } else {
                setPinnedModule(spanModule as string);
                onHover(spanModule);
              }
            }
            const tooltipHttp = (
              <Fragment>
                <div>Time spent on {spanModule} across all endpoints</div>
                <IconPin
                  isSolid={spanModule === pinnedModule}
                  onClick={handleModulePin}
                />{' '}
                {percent}%
              </Fragment>
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
                  color={COLORS[index]}
                  onMouseOver={() => pinnedModule === null && onHover(spanModule)}
                  onMouseLeave={() => pinnedModule === null && onHover(null)}
                >
                  {spanModule === pinnedModule && (
                    <StyledIconPin isSolid color={FONT_COLORS[index]} />
                  )}
                  <SegmentText fontColor={FONT_COLORS[index]}>
                    {spanModule} {percent}%
                  </SegmentText>
                </Segment>
              </StyledTooltip>
            );
          })}
      </SegmentContainer>
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
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
  display: block ruby;
  ${p => !p.hasLink && 'cursor: auto'}
`;

const StyledTooltip = styled(Tooltip)<{percent: number}>`
  width: ${p => p.percent}%;
  min-width: 16px;
`;

const StyledIconPin = styled(IconPin)<{color: string}>`
  color: ${p => p.color};
  padding: 0 ${space(0.25)};
  margin-right: ${space(0.25)};
  height: 100%;
`;

const SegmentText = styled('span')<{fontColor: string}>`
  padding: ${space(0.5)};
  color: ${p => p.fontColor};
  white-space: nowrap;
`;
