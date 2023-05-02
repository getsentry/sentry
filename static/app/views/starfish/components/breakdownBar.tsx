import {Fragment, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import {useQuery} from 'sentry/utils/queryClient';
import {DatabaseDurationChart} from 'sentry/views/starfish/views/webServiceView/databaseDurationChart';
import {HttpBreakdownChart} from 'sentry/views/starfish/views/webServiceView/httpBreakdownChart';
import {
  getDatabaseTimeSpent,
  getDbThroughput,
  getHttpThroughput,
  getOtherDomains,
  getTopHttpDomains,
} from 'sentry/views/starfish/views/webServiceView/queries';

const COLORS = ['#402A65', '#694D99', '#9A81C4', '#BBA6DF', '#EAE2F8'];
const TOOLTIP_DELAY = 800;
const HOST = 'http://localhost:8080';

type ModuleSegment = {
  module: string;
  sum: number;
};
type Props = {
  segments: ModuleSegment[];
  title: string;
  transaction?: string;
};

function FacetBreakdownBar({segments, title, transaction: maybeTransaction}: Props) {
  const [hoveredValue, setHoveredValue] = useState<ModuleSegment | null>(null);
  const [currentSegment, setCurrentSegment] = useState<
    ModuleSegment['module'] | undefined
  >(segments[0]?.module);
  const totalValues = segments.reduce((acc, segment) => acc + segment.sum, 0);

  const transaction = maybeTrasaction ?? '';

  const {isLoading: isHttpDurationDataLoading, data: httpDurationData} = useQuery({
    queryKey: [`topDomains${transaction}`],
    queryFn: () =>
      fetch(`${HOST}/?query=${getTopHttpDomains({transaction})}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {isLoading: isOtherHttpDurationDataLoading, data: otherHttpDurationData} =
    useQuery({
      queryKey: [`otherDomains${transaction}`],
      queryFn: () =>
        fetch(`${HOST}/?query=${getOtherDomains({transaction})}`).then(res => res.json()),
      retry: false,
      initialData: [],
    });

  const {isLoading: isDbDurationLoading, data: dbDurationData} = useQuery({
    queryKey: [`databaseDuration${transaction}`],
    queryFn: () =>
      fetch(`${HOST}/?query=${getDatabaseTimeSpent({transaction})}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  const {data: dbThroughputData} = useQuery({
    queryKey: [`dbThroughputData${transaction}`],
    queryFn: () =>
      fetch(`${HOST}/?query=${getDbThroughput({transaction})}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {data: httpThroughputData} = useQuery({
    queryKey: [`httpThroughputData${transaction}`],
    queryFn: () =>
      fetch(`${HOST}/?query=${getHttpThroughput({transaction})}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  function renderTitle() {
    return (
      <Title>
        <TitleType>{title}</TitleType>
      </Title>
    );
  }

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
        {segments.map((value, index) => {
          const pct = percent(value.sum, totalValues);
          const pctLabel = Math.floor(pct);
          const segmentProps = {
            index,
            onClick: () => {
              setCurrentSegment(value.module);
            },
          };
          return (
            <div
              key={`segment-${value.module}`}
              style={{width: pct + '%'}}
              onMouseOver={() => {
                setHoveredValue(value);
              }}
              onMouseLeave={() => setHoveredValue(null)}
            >
              <Tooltip skipWrapper delay={TOOLTIP_DELAY} title={value.module}>
                <Segment
                  aria-label={`${value.module} ${t('segment')}`}
                  color={COLORS[index]}
                  {...segmentProps}
                >
                  {/* if the first segment is 6% or less, the label won't fit cleanly into the segment, so don't show the label */}
                  {index === 0 && pctLabel > 6 ? `${pctLabel}%` : null}
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
          {segments.map((segment, index) => {
            const pctLabel = Math.floor(percent(segment.sum, totalValues));
            const unfocus = !!hoveredValue && hoveredValue.module !== segment.module;
            const focus = hoveredValue?.module === segment.module;

            return (
              <li key={`segment-${segment.module}-${index}`}>
                <LegendRow
                  onMouseOver={() => setHoveredValue(segment)}
                  onMouseLeave={() => setHoveredValue(null)}
                  onClick={() => setCurrentSegment(segment.module)}
                >
                  <LegendDot color={COLORS[index]} focus={focus} />
                  <LegendText unfocus={unfocus}>
                    {segment.module ?? (
                      <NotApplicableLabel>{t('n/a')}</NotApplicableLabel>
                    )}
                  </LegendText>
                  {<LegendPercent>{`${pctLabel}%`}</LegendPercent>}
                </LegendRow>
              </li>
            );
          })}
        </LegendContainer>
      </LegendAnimateContainer>
    );
  }

  function renderChart(mod: string | undefined) {
    switch (mod) {
      case 'http':
        return (
          <HttpBreakdownChart
            isHttpDurationDataLoading={isHttpDurationDataLoading}
            isOtherHttpDurationDataLoading={isOtherHttpDurationDataLoading}
            httpDurationData={httpDurationData}
            otherHttpDurationData={otherHttpDurationData}
            httpThroughputData={httpThroughputData}
          />
        );
      case 'db':
      default:
        return (
          <DatabaseDurationChart
            isDbDurationLoading={isDbDurationLoading}
            dbDurationData={dbDurationData}
            dbThroughputData={dbThroughputData}
          />
        );
    }
  }

  return (
    <Fragment>
      <TagSummary>
        <details open aria-expanded onClick={e => e.preventDefault()}>
          <StyledSummary>
            <TagHeader>
              {renderTitle()}
              {renderSegments()}
            </TagHeader>
          </StyledSummary>
          {renderLegend()}
        </details>
      </TagSummary>
      {renderChart(currentSegment)}
    </Fragment>
  );
}

export default FacetBreakdownBar;

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

const Title = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
  justify-content: space-between;
  margin-bottom: ${space(1)};
  line-height: 1.1;
`;

const TitleType = styled('div')`
  flex: none;
  color: ${p => p.theme.textColor};
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(1)};
  align-self: center;
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
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(1)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 0.3s;
  color: ${p => (p.unfocus ? p.theme.gray300 : p.theme.gray400)};
`;

const LegendPercent = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
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
