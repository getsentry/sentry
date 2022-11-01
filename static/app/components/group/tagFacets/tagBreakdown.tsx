import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';

type TagBreakdownProps = {
  maxItems: number;
  points: any;
  selectedTag: string;
};

function TagBreakdown({points, maxItems, selectedTag}: TagBreakdownProps) {
  const theme = useTheme();
  const colors = [
    theme.purple400,
    theme.red400,
    theme.green400,
    theme.yellow400,
    theme.blue400,
    theme.translucentGray100,
  ];

  const sumPoints = (sum, point) => sum + point.count;

  const pointsTotal = points.reduce(sumPoints, 0);
  const otherTotal = points.slice(maxItems).reduce(sumPoints, 0);
  const segments = maxItems ? points.slice(0, maxItems) : points;

  return (
    <Container>
      <TagDistributionMeter
        title={selectedTag}
        totalValues={pointsTotal}
        segments={segments}
        colors={colors}
        showTitle={false}
      />
      {segments.map((segment, index) => {
        return (
          <BreakdownRow key={segment.name}>
            <LegendIcon color={colors[index]} />
            {segment.name}
            <Percent>
              {formatPercentage(Math.floor(percent(segment.count, pointsTotal)) / 100, 0)}
            </Percent>
          </BreakdownRow>
        );
      })}
      {!!(maxItems && otherTotal) && (
        <BreakdownRow key={t('Other')}>
          <LegendIcon color={colors[colors.length - 1]} />
          <OtherLabel>{t('Other')}</OtherLabel>
          <Percent>
            {formatPercentage(Math.floor(percent(otherTotal, pointsTotal)) / 100, 0)}
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
  gap: ${space(1)};
`;

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
