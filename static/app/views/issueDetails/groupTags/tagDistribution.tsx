import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports
import color from 'color';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DeviceName} from 'sentry/components/deviceName';
import {Version} from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import {percent} from 'sentry/utils';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

/**
 * How many values a panel draws before folding the rest into "Other". Not a
 * prop: every breakdown -- issue tags, feature flags, Seer's event and log
 * embeds -- should cut off at the same place.
 */
const MAX_VALUES = 3;

interface TagDistributionValue {
  count: number;
  value: string;
  /** Rendered in place of the raw value, e.g. a `Version` or a `DeviceName`. */
  node?: React.ReactNode;
}

interface TagDistributionPanelProps {
  /**
   * The row tooltip, e.g. "12 of 40 tagged events". Built by the caller so each
   * surface keeps its own copy as one whole sentence for translators.
   */
  formatCount: (count: number, total: number) => React.ReactNode;
  title: string;
  /**
   * Everything the values were counted out of, including the ones the panel does
   * not draw -- this is what gives the "Other" row a size.
   */
  totalValues: number;
  /** Most common first; the panel draws the first few and folds away the rest. */
  values: TagDistributionValue[];
}

/**
 * How often each value of one key occurs, as a labelled bar per value. Purely
 * presentational, and the one implementation of this shape: a tag on an issue
 * and an attribute on a log come out looking the same because they render here.
 */
export function TagDistributionPanel({
  formatCount,
  title,
  totalValues,
  values,
}: TagDistributionPanelProps) {
  const visibleTagValues = values.slice(0, MAX_VALUES);

  const totalVisible = visibleTagValues.reduce((sum, value) => sum + value.count, 0);
  const hasOther = totalVisible < totalValues;

  const otherPercentage =
    100 -
    visibleTagValues.reduce(
      (sum, value) => sum + Math.round(percent(value.count, totalValues)),
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
        <Tooltip title={title} showOnlyOnOverflow skipWrapper>
          {title}
        </Tooltip>
      </TagHeader>
      <TagValueContent>
        {visibleTagValues.map((tagValue, tagValueIdx) => {
          const percentage = Math.round(percent(tagValue.count, totalValues));
          // Ensure no item shows 100% when there are multiple items
          const hasMultipleItems = values.length > 1 || hasOther;
          const cappedPercentage =
            hasMultipleItems && percentage >= 100 ? 99 : percentage;
          const displayPercentage =
            cappedPercentage < 1
              ? '<1%'
              : hasMultipleItems && percentage >= 100
                ? '>99%'
                : `${cappedPercentage.toFixed(0)}%`;

          const valueComponent =
            tagValue.node ??
            (tagValue.value === '' ? (
              <Text variant="muted">{t('(empty)')}</Text>
            ) : (
              tagValue.value
            ));

          return (
            <TagValueRow key={tagValueIdx}>
              <Tooltip delay={300} title={valueComponent} skipWrapper>
                <TagValue>{valueComponent}</TagValue>
              </Tooltip>
              <Tooltip title={formatCount(tagValue.count, totalValues)} skipWrapper>
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
              title={formatCount(totalValues - totalVisible, totalValues)}
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

/**
 * Renders `release` and `device` values the way the rest of the product does.
 * Returns nothing for every other key, and for a missing value, so the panel
 * falls back to the raw string and to its own "(empty)" marker.
 */
function renderTagValue(tagKey: string, value: string): React.ReactNode {
  if (value === '') {
    return undefined;
  }
  if (tagKey === 'release') {
    return <Version version={value} anchor={false} />;
  }
  if (tagKey === 'device') {
    return <DeviceName value={value} />;
  }
  return undefined;
}

export function TagDistribution({tag}: {tag: GroupTag}) {
  return (
    <TagDistributionPanel
      formatCount={(count, total) =>
        tct('[count] of [total] tagged events', {
          count: count.toLocaleString(),
          total: total.toLocaleString(),
        })
      }
      title={tag.key}
      totalValues={tag.totalValues}
      values={tag.topValues.map(topValue => ({
        count: topValue.count,
        value: topValue.value,
        node: renderTagValue(tag.key, topValue.value),
      }))}
    />
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
  gap: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.md};
`;

const TagHeader = styled('h5')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const progressBarWidth = '45px'; // Prevent percentages from overflowing
const TagValueContent = styled('div')`
  display: grid;
  grid-template-columns: 4fr auto ${progressBarWidth};
  color: ${p => p.theme.tokens.content.secondary};
  grid-column-gap: ${p => p.theme.space.md};
`;

const TagValueRow = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  padding: 0 ${p => p.theme.space.sm};
  margin: 0 -${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};

  &:hover {
    background-color: ${p => p.theme.tokens.background.tertiary};
  }
`;

const TagValue = styled('div')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const TagBarPlaceholder = styled('div')`
  position: relative;
  height: ${p => p.theme.space.md};
  width: 100%;
  border-radius: 3px;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: inset 0 0 0 1px ${p => p.theme.tokens.border.transparent.neutral.muted};
  background: ${p => color(p.theme.colors.gray400).alpha(0.1).toString()};
  overflow: hidden;
`;

const TagBarContainer = styled('div')`
  height: ${p => p.theme.space.md};
  position: absolute;
  left: 0;
  top: 0;
  min-width: ${p => p.theme.space['2xs']};
  &:before {
    position: absolute;
    inset: 0;
    content: '';
    background: ${p =>
      `linear-gradient(to right, ${color(p.theme.colors.gray400).alpha(0.5).toString()} 0px, ${color(p.theme.colors.gray400).alpha(0.7).toString()} ${progressBarWidth})`};
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
