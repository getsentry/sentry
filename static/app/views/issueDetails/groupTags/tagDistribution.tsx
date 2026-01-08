import styled from '@emotion/styled';
import Color from 'color';

import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DeviceName} from 'sentry/components/deviceName';
import Version from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

export function TagDistribution({tag}: {tag: GroupTag}) {
  const visibleTagValues = tag.topValues.slice(0, 3);

  const totalVisible = visibleTagValues.reduce((sum, value) => sum + value.count, 0);
  const hasOther = totalVisible < tag.totalValues;

  const otherPercentage =
    100 -
    visibleTagValues.reduce(
      (sum, value) => sum + Math.round(percent(value.count, tag.totalValues)),
      0
    );
  const otherDisplayPercentage =
    otherPercentage < 1
      ? '<1%'
      : visibleTagValues.length > 0 && otherPercentage >= 100
        ? '>99%'
        : `${otherPercentage.toFixed(0)}%`;

  return (
    <TagPanel>
      <TagHeader data-underline-on-hover="true">
        <Tooltip title={tag.key} showOnlyOnOverflow skipWrapper>
          {tag.key}
        </Tooltip>
      </TagHeader>
      <TagValueContent>
        {visibleTagValues.map((tagValue, tagValueIdx) => {
          const percentage = Math.round(percent(tagValue.count, tag.totalValues));
          // Ensure no item shows 100% when there are multiple items
          const hasMultipleItems = tag.topValues.length > 1 || hasOther;
          const cappedPercentage =
            hasMultipleItems && percentage >= 100 ? 99 : percentage;
          const displayPercentage =
            cappedPercentage < 1
              ? '<1%'
              : hasMultipleItems && percentage >= 100
                ? '>99%'
                : `${cappedPercentage.toFixed(0)}%`;

          let valueComponent: React.ReactNode = tagValue.value;
          if (tagValue.value === '') {
            valueComponent = <Text variant="muted">{t('(empty)')}</Text>;
          } else {
            if (tag.key === 'release') {
              valueComponent = <Version version={tagValue.value} anchor={false} />;
            } else if (tag.key === 'device') {
              valueComponent = <DeviceName value={tagValue.value} />;
            }
          }

          return (
            <TagValueRow key={tagValueIdx}>
              <Tooltip delay={300} title={valueComponent} skipWrapper>
                <TagValue>{valueComponent}</TagValue>
              </Tooltip>
              <Tooltip
                title={tct('[count] of [total] tagged events', {
                  count: tagValue.count.toLocaleString(),
                  total: tag.totalValues.toLocaleString(),
                })}
                skipWrapper
              >
                <TooltipContainer>
                  <TagBarValue>{displayPercentage}</TagBarValue>
                  <TagBar percentage={percentage} />
                </TooltipContainer>
              </Tooltip>
            </TagValueRow>
          );
        })}
        {hasOther && (
          <TagValueRow>
            <TagValue>{t('Other')}</TagValue>
            <Tooltip
              title={tct('[count] of [total] tagged events', {
                count: (tag.totalValues - totalVisible).toLocaleString(),
                total: tag.totalValues.toLocaleString(),
              })}
              skipWrapper
            >
              <TooltipContainer>
                <TagBarValue>{otherDisplayPercentage}</TagBarValue>
                <TagBar percentage={otherPercentage} />
              </TooltipContainer>
            </Tooltip>
          </TagValueRow>
        )}
      </TagValueContent>
    </TagPanel>
  );
}

export function TagBar({
  percentage,
  style,
  ...props
}: {
  percentage: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <TagBarPlaceholder>
      <TagBarContainer style={{width: `${percentage}%`, ...style}} {...props} />
    </TagBarPlaceholder>
  );
}

const TagPanel = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${space(1)};
`;

const TagHeader = styled('h5')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
  ${p => p.theme.overflowEllipsis}
`;

const progressBarWidth = '45px'; // Prevent percentages from overflowing
const TagValueContent = styled('div')`
  display: grid;
  grid-template-columns: 4fr auto ${progressBarWidth};
  color: ${p => p.theme.subText};
  grid-column-gap: ${space(1)};

  & > :nth-child(2n) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const TagValueRow = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
`;

const TagValue = styled('div')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const TagBarPlaceholder = styled('div')`
  position: relative;
  height: ${space(1)};
  width: 100%;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.border.transparent.neutral.muted};
  background: ${p => Color(p.theme.colors.gray400).alpha(0.1).toString()};
  overflow: hidden;
`;

const TagBarContainer = styled('div')`
  height: ${space(1)};
  position: absolute;
  left: 0;
  top: 0;
  min-width: ${space(0.25)};
  &:before {
    position: absolute;
    inset: 0;
    content: '';
    background: ${p =>
      `linear-gradient(to right, ${Color(p.theme.colors.gray400).alpha(0.5).toString()} 0px, ${Color(p.theme.colors.gray400).alpha(0.7).toString()} ${progressBarWidth})`};
    width: 100%;
  }
`;

const TagBarValue = styled('div')`
  text-align: right;
`;

const TooltipContainer = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 2 / -1;
  align-items: center;
`;
