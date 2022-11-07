import styled from '@emotion/styled';

import {TagSegment} from 'sentry/actionCreators/events';
import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';

type TagData = TagSegment & {active?: boolean; tooltip?: string};

type TagBreakdownProps = {
  colors: string[];
  maxItems: number;
  segments: TagData[];
  selectedTag: string;
};

function TagBreakdown({segments, maxItems, selectedTag, colors}: TagBreakdownProps) {
  const sumPoints = (sum, point) => sum + point.count;

  const segmentsTotal = segments.reduce(sumPoints, 0);
  const otherTotal = segments.slice(maxItems).reduce(sumPoints, 0);
  const visibleSegments = maxItems ? segments.slice(0, maxItems) : segments;

  return (
    <Container>
      <TagDistributionMeter
        title={selectedTag}
        totalValues={segmentsTotal}
        segments={visibleSegments}
        colors={colors}
        showTitle={false}
      />
      {visibleSegments.map((segment, index) => {
        return (
          <BreakdownRow key={segment.name}>
            <LegendIcon color={colors[index]} />
            <Tooltip title={segment.tooltip}>
              <TagLabel active={segment.active}>{segment.name}</TagLabel>
            </Tooltip>
            <Percent>
              {formatPercentage(
                Math.floor(percent(segment.count, segmentsTotal)) / 100,
                0
              )}
            </Percent>
          </BreakdownRow>
        );
      })}
      {!!(maxItems && otherTotal) && (
        <BreakdownRow key={t('Other')}>
          <LegendIcon color={colors[colors.length - 1]} />
          <TagLabel>
            <OtherLabel>{t('Other')}</OtherLabel>
          </TagLabel>
          <Percent>
            {formatPercentage(Math.floor(percent(otherTotal, segmentsTotal)) / 100, 0)}
          </Percent>
        </BreakdownRow>
      )}
    </Container>
  );
}

export default TagBreakdown;

const LegendIcon = styled('div')<{color: string}>`
  height: 12px;
  width: 12px;
  border-radius: 24px;
  background-color: ${p => p.color};
`;

const OtherLabel = styled('div')`
  color: ${p => p.theme.gray300};
`;

const Percent = styled('div')`
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.gray300};
`;

const BreakdownRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const TagLabel = styled('div')<{active?: boolean}>`
  padding: 0 ${space(0.5)};

  ${p =>
    p.active &&
    `
    background-color: ${p.theme.gray200};
    border-radius: 4px;
  `}
`;
