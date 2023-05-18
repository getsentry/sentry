import {Fragment, useState} from 'react';
import {Link} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import * as qs from 'query-string';

import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import {getUtcDateString} from 'sentry/utils/dates';
import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  getOtherDomainsActionsAndOpTimeseries,
  getTopDomainsActionsAndOp,
  getTopDomainsActionsAndOpTimeseries,
  totalCumulativeTime,
} from 'sentry/views/starfish/views/webServiceView/queries';
import {WebServiceBreakdownChart} from 'sentry/views/starfish/views/webServiceView/webServiceBreakdownChart';

const HOST = 'http://localhost:8080';

type ModuleSegment = {
  action: string;
  domain: string;
  module: string;
  num_spans: number;
  span_operation: string;
  sum: number;
};
type Props = {
  title: string;
  transaction?: string;
};

export function getSegmentLabel(span_operation, action, domain) {
  if (span_operation === 'http.client') {
    return t('%s requests to %s', action, domain);
  }
  if (span_operation === 'db') {
    return t('%s queries on %s', action, domain);
  }
  return span_operation || domain || undefined;
}

function getNumSpansLabel(segment) {
  if (segment.span_operation === 'other' && segment.num_spans === 0) {
    return t('Other');
  }
  if (segment.num_spans && segment.module && segment.module !== 'none') {
    return t('%s %s spans', segment.num_spans, segment.module);
  }
  return t('%s spans', segment.num_spans);
}

function getGroupingLabel(segment) {
  if (segment.module === 'http') {
    return t('Action: %s, Host: %s', segment.action, segment.domain);
  }
  if (segment.module === 'db') {
    return t('Action: %s, Table: %s', segment.action, segment.domain);
  }
  if (segment.module !== 'other') {
    return t('Operation: %s', segment.span_operation);
  }
  return '';
}

function FacetBreakdownBar({transaction: maybeTransaction}: Props) {
  const theme = useTheme();
  const {selection} = usePageFilters();
  const [hoveredValue, setHoveredValue] = useState<ModuleSegment | null>(null);

  const transaction = maybeTransaction ?? '';

  const {data: segments} = useQuery({
    queryKey: ['webServiceSpanGrouping', transaction],
    queryFn: () =>
      fetch(`${HOST}/?query=${getTopDomainsActionsAndOp({transaction})}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  const {data: cumulativeTime} = useQuery({
    queryKey: ['totalCumulativeTime', transaction],
    queryFn: () =>
      fetch(`${HOST}/?query=${totalCumulativeTime({transaction})}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  const totalValues = cumulativeTime.reduce((acc, segment) => acc + segment.sum, 0);
  const totalSegments = segments.reduce((acc, segment) => acc + segment.sum, 0);
  const otherValue = totalValues - totalSegments;
  const otherSegment = {
    span_operation: 'other',
    sum: otherValue,
    action: '',
    domain: '',
    num_spans: 0,
    module: 'other',
  } as ModuleSegment;

  let topConditions =
    segments.length > 0
      ? ` (span_operation = '${segments[0].span_operation}' ${
          segments[0].action ? `AND action = '${segments[0].action}'` : ''
        } ${segments[0].domain ? `AND domain = '${segments[0].domain}'` : ''})`
      : '';

  for (let index = 1; index < segments.length; index++) {
    const element = segments[index];
    topConditions = topConditions.concat(
      ' OR ',
      `(span_operation = '${element.span_operation}' ${
        element.action ? `AND action = '${element.action}'` : ''
      } ${element.domain ? `AND domain = '${element.domain}'` : ''})`
    );
  }

  const {isLoading: isTopDataLoading, data: topData} = useQuery({
    queryKey: ['topSpanGroupTimeseries', transaction, topConditions],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getTopDomainsActionsAndOpTimeseries({
          transaction,
          topConditions,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isOtherDataLoading, data: otherData} = useQuery({
    queryKey: ['otherSpanGroupTimeseries', transaction, topConditions],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getOtherDomainsActionsAndOpTimeseries({
          transaction,
          topConditions,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const legendColors = theme.charts.getColorPalette(5);

  function renderLegend() {
    return (
      <LegendAnimateContainer expanded animate={{height: '100%', opacity: 1}}>
        <LegendContainer>
          {[...segments, otherSegment].map((segment, index) => {
            const pctLabel = Math.floor(percent(segment.sum, totalValues));
            const unfocus = !!hoveredValue && hoveredValue !== segment;
            const focus = hoveredValue === segment;
            const label = getSegmentLabel(
              segment.span_operation,
              segment.action,
              segment.domain
            );
            const numSpansLabel = getNumSpansLabel(segment);
            const groupingLabel = getGroupingLabel(segment);
            const {start, end, utc, period} = selection.datetime;
            const spansLinkQueryParams =
              start && end
                ? {start: getUtcDateString(start), end: getUtcDateString(end), utc}
                : {statsPeriod: period};
            ['span_operation', 'action', 'domain'].forEach(key => {
              if (segment[key] !== undefined && segment[key] !== null) {
                spansLinkQueryParams[key] = segment[key];
              }
            });

            const spansLink =
              segment.module === 'other'
                ? `/starfish/spans/`
                : `/starfish/spans/?${qs.stringify(spansLinkQueryParams)}`;

            return (
              <li key={`segment-${label}-${index}`}>
                <Link to={spansLink}>
                  <div
                    onMouseOver={() => setHoveredValue(segment)}
                    onMouseLeave={() => setHoveredValue(null)}
                    onClick={() => {}}
                  >
                    <LegendRow>
                      <LegendDot color={legendColors[index]} focus={focus} />
                      <LegendText unfocus={unfocus}>
                        {numSpansLabel ?? (
                          <NotApplicableLabel>{t('n/a')}</NotApplicableLabel>
                        )}
                      </LegendText>
                      <LegendPercent unfocus={unfocus}>{`${pctLabel}%`}</LegendPercent>
                    </LegendRow>
                    <SpanGroupingText color={legendColors[index]} unfocus={unfocus}>
                      <SpanGroupLabelTruncate value={groupingLabel} maxLength={40} />
                    </SpanGroupingText>
                  </div>
                </Link>
              </li>
            );
          })}
        </LegendContainer>
      </LegendAnimateContainer>
    );
  }

  const cumulativeSummary = <TagSummary>{renderLegend()}</TagSummary>;

  return (
    <Fragment>
      <WebServiceBreakdownChart
        segments={segments}
        isTopDataLoading={isTopDataLoading}
        topData={topData}
        isOtherDataLoading={isOtherDataLoading}
        otherData={otherData}
        cumulativeSummary={cumulativeSummary}
      />
    </Fragment>
  );
}

export default FacetBreakdownBar;

const TagSummary = styled('div')`
  margin-bottom: ${space(2)};
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
`;

const SpanGroupingText = styled('div')<{
  color: string;
  unfocus: boolean;
}>`
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 0 ${space(1)} 0;
  color: ${p => p.color};
  opacity: ${p => (p.unfocus ? '0.6' : '1')};
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
  margin-left: ${space(1)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 0.3s;
  color: ${p => (p.unfocus ? p.theme.gray300 : p.theme.gray400)};
`;

const LegendPercent = styled('span')<{unfocus: boolean}>`
  margin-left: ${space(1)};
  color: ${p => (p.unfocus ? p.theme.gray300 : p.theme.gray400)};
  text-align: right;
  flex-grow: 1;
`;

const NotApplicableLabel = styled('span')`
  color: ${p => p.theme.gray300};
`;

export const SpanGroupLabelTruncate = styled(Truncate)`
  white-space: nowrap;
`;
