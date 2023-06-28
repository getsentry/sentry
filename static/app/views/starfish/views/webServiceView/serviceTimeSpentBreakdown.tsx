import {Fragment, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined, percent} from 'sentry/utils';
import {getUtcDateString} from 'sentry/utils/dates';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {
  NULL_SPAN_CATEGORY,
  OTHER_SPAN_GROUP_MODULE,
} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const {SPAN_SELF_TIME} = SpanMetricsFields;
const TOOLTIP_DELAY = 800;

type Props = {
  transaction?: string;
  transactionMethod?: string;
};

export type DataRow = {
  name: string;
  value: number;
};

export function ServiceTimeSpentBreakdown({transaction, transactionMethod}: Props) {
  const pageFilter = usePageFilters();
  const organization = useOrganization();
  const location = useLocation();
  const theme = useTheme();
  const {selection} = pageFilter;

  const [hoveredValue, setHoveredValue] = useState<DataRow | null>(null);

  const topCategoryView = EventView.fromSavedQuery({
    name: '',
    fields: [`sum(${SPAN_SELF_TIME})`, 'span.category'],
    query: `transaction.op:http.server ${
      transaction ? `transaction:${transaction}` : ''
    } ${transactionMethod ? `transaction.method:${transactionMethod}` : ''}`,
    dataset: DiscoverDatasets.SPANS_METRICS,
    start: selection.datetime.start ?? undefined,
    end: selection.datetime.end ?? undefined,
    range: selection.datetime.period ?? undefined,
    orderby: '-sum_span_self_time',
    projects: selection.projects,
    version: 2,
  });

  const totalView = topCategoryView
    .clone()
    .withColumns([
      {kind: 'function', function: ['sum', SPAN_SELF_TIME, undefined, undefined]},
    ]);

  const {data: segments} = useDiscoverQuery({
    eventView: topCategoryView,
    orgSlug: organization.slug,
    referrer: 'starfish-web-service.span-category-breakdown',
    location,
    limit: 4,
  });

  const {data: cumulativeTime} = useDiscoverQuery({
    eventView: totalView,
    orgSlug: organization.slug,
    referrer: 'starfish-web-service.total-time',
    location,
  });

  const totalValues = cumulativeTime?.data[0]?.[`sum(${SPAN_SELF_TIME})`]
    ? parseInt(cumulativeTime?.data[0][`sum(${SPAN_SELF_TIME})`] as string, 10)
    : 0;
  const totalSegments =
    segments?.data.reduce(
      (acc, segment) => acc + parseInt(segment[`sum(${SPAN_SELF_TIME})`] as string, 10),
      0
    ) ?? 0;

  const otherValue = totalValues ? totalValues - totalSegments : 0;

  const transformedData: DataRow[] = [];

  if (defined(segments)) {
    for (let index = 0; index < segments.data.length; index++) {
      const element = segments.data[index];
      const category = element['span.category'] as string;
      transformedData.push({
        value: parseInt(element[`sum(${SPAN_SELF_TIME})`] as string, 10),
        name: category === '' ? NULL_SPAN_CATEGORY : category,
      });
    }

    if (otherValue > 0) {
      transformedData.push({
        value: otherValue,
        name: OTHER_SPAN_GROUP_MODULE,
      });
    }
  }

  const colorPalette = theme.charts.getColorPalette(transformedData.length - 2);

  function renderSegments() {
    if (totalValues === 0) {
      return (
        <SegmentBar>
          <p>{t('No recent data.')}</p>
        </SegmentBar>
      );
    }

    return (
      <SegmentBar>
        {transformedData.map((value, index) => {
          const pct = percent(value.value, totalValues);
          const pctLabel = formatPercentage(value.value / totalValues, 1);
          const segmentProps = {
            index,
            onClick: () => {},
          };
          return (
            <div
              key={`segment-${value.name}`}
              style={{width: pct + '%'}}
              onMouseOver={() => {
                setHoveredValue(value);
              }}
              onMouseLeave={() => setHoveredValue(null)}
            >
              <Tooltip skipWrapper delay={TOOLTIP_DELAY} title={value.name}>
                <Segment
                  aria-label={`${value.name}`}
                  color={colorPalette[index]}
                  {...segmentProps}
                >
                  {/* if the first segment is 6% or less, the label won't fit cleanly into the segment, so don't show the label */}
                  {index === 0 && pct > 6 ? pctLabel : null}
                </Segment>
              </Tooltip>
            </div>
          );
        })}
      </SegmentBar>
    );
  }

  function renderLegend() {
    return (
      <LegendAnimateContainer expanded animate={{height: '100%', opacity: 1}}>
        <LegendContainer>
          {transformedData.map((segment, index) => {
            const pctLabel = formatPercentage(segment.value / totalValues, 1);
            const unfocus = !!hoveredValue && hoveredValue.name !== segment.name;
            const focus = hoveredValue?.name === segment.name;

            const name = segment.name;
            const {start, end, utc, period} = selection.datetime;

            const spansLinkQueryParams =
              start && end
                ? {start: getUtcDateString(start), end: getUtcDateString(end), utc}
                : {statsPeriod: period};
            let spansLink;
            if (name === 'db') {
              spansLink = `/starfish/database/?${qs.stringify(spansLinkQueryParams)}`;
            } else if (name === 'http') {
              spansLink = `/starfish/api/?${qs.stringify(spansLinkQueryParams)}`;
            } else if (name === 'Other') {
              spansLinkQueryParams['!span.category'] = transformedData.map(r => r.name);
            } else {
              spansLinkQueryParams['span.module'] = 'Other';
              spansLinkQueryParams['span.category'] = name;
            }

            if (!spansLink) {
              spansLink = `/starfish/spans/?${qs.stringify(spansLinkQueryParams)}`;
            }

            return (
              <li key={`segment-${segment.name}-${index}`}>
                <LegendRow
                  onMouseOver={() => setHoveredValue(segment)}
                  onMouseLeave={() => setHoveredValue(null)}
                  onClick={() => {}}
                >
                  <LegendDot color={colorPalette[index]} focus={focus} />
                  <Link to={spansLink}>
                    <LegendText unfocus={unfocus}>
                      {segment.name ?? (
                        <NotApplicableLabel>{t('n/a')}</NotApplicableLabel>
                      )}
                    </LegendText>
                  </Link>
                  {<LegendPercent>{pctLabel}</LegendPercent>}
                </LegendRow>
              </li>
            );
          })}
        </LegendContainer>
      </LegendAnimateContainer>
    );
  }

  return (
    <Fragment>
      <MiniChartPanel title={t('Time Spent Breakdown')} subtitle={t('Last 14 days')}>
        <Spacer />
        <TagSummary>
          <details open aria-expanded onClick={e => e.preventDefault()}>
            <StyledSummary>
              <TagHeader>{renderSegments()}</TagHeader>
            </StyledSummary>
            {renderLegend()}
          </details>
        </TagSummary>
      </MiniChartPanel>
    </Fragment>
  );
}

const TagSummary = styled('div')`
  margin-bottom: ${space(2)};
`;

const TagHeader = styled('span')<{clickable?: boolean}>`
  ${p => (p.clickable ? 'cursor: pointer' : null)};
`;

const SegmentBar = styled('div')`
  display: flex;
  overflow: hidden;
`;

const Spacer = styled('div')`
  margin-top: ${space(1)};
`;

const Segment = styled('span', {shouldForwardProp: isPropValid})<{color: string}>`
  &:hover {
    color: ${p => p.theme.white};
  }
  display: block;
  width: 100%;
  height: ${space(2)};
  color: ${p => p.theme.white};
  outline: none;
  background-color: ${p => p.color};
  text-align: right;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: 1px ${space(0.5)} 0 0;
`;

const LegendAnimateContainer = styled(motion.div, {
  shouldForwardProp: prop =>
    prop === 'animate' || (prop !== 'expanded' && isPropValid(prop)),
})<{expanded: boolean}>`
  height: 0;
  opacity: 0;
  ${p => (!p.expanded ? 'overflow: hidden;' : '')}
`;

const LegendContainer = styled('ol')`
  list-style: none;
  padding: 0;
  margin: ${space(1)} 0;
`;

const LegendRow = styled('div')`
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: ${space(0.5)} 0;
`;

const LegendDot = styled('span')<{color: string; focus: boolean}>`
  padding: 0;
  position: relative;
  width: 11px;
  height: 11px;
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => p.color};
  &:after {
    content: '';
    border-radius: 50%;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    outline: ${p => p.theme.gray100} ${space(0.5)} solid;
    opacity: ${p => (p.focus ? '1' : '0')};
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const LegendText = styled('span')<{unfocus: boolean}>`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-left: ${space(1)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 0.3s;
  color: ${p => (p.unfocus ? p.theme.gray300 : p.theme.gray400)};
`;

const LegendPercent = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-left: ${space(1)};
  color: ${p => p.theme.gray300};
  text-align: right;
  flex-grow: 1;
`;

const NotApplicableLabel = styled('span')`
  color: ${p => p.theme.gray300};
`;

const StyledSummary = styled('summary')`
  &::-webkit-details-marker {
    display: none;
  }
`;
