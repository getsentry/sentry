import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {DeviceName} from 'sentry/components/deviceName';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {usePrefetchTagValues} from 'sentry/views/issueDetails/utils';

export function TagDistribution({tag, groupId}: {groupId: string; tag: GroupTag}) {
  const location = useLocation();
  const [prefetchEnabled, setPrefetchEnabled] = useState(false);
  const hoverTimeoutRef = useRef<number | undefined>();

  usePrefetchTagValues(tag.key, groupId, prefetchEnabled);
  const visibleTagValues = tag.topValues.slice(0, 3);

  const totalVisible = visibleTagValues.reduce((sum, value) => sum + value.count, 0);
  const hasOther = totalVisible < tag.totalValues;

  const otherPercentage = Math.floor(
    percent(tag.totalValues - totalVisible, tag.totalValues)
  );
  const otherDisplayPercentage =
    otherPercentage < 1 ? '<1%' : `${otherPercentage.toFixed(0)}%`;

  // We only want to prefetch if the user hovers over the tag for 1 second
  // This is to prevent every tag from prefetch when a user scrolls
  const handleMouseEnter = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setPrefetchEnabled(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = undefined;
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div>
      <TagPanel
        to={{
          pathname: `${location.pathname}${tag.key}/`,
          query: location.query,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <TagHeader>
          <Tooltip title={tag.key} showOnlyOnOverflow skipWrapper>
            <TagTitle>{tag.key}</TagTitle>
          </Tooltip>
        </TagHeader>
        <TagValueContent>
          {visibleTagValues.map((tagValue, tagValueIdx) => {
            const percentage = Math.floor(percent(tagValue.count, tag.totalValues));
            const displayPercentage =
              percentage < 1 ? '<1%' : `${percentage.toFixed(0)}%`;
            return (
              <TagValueRow key={tagValueIdx}>
                <Tooltip delay={300} title={tagValue.name} skipWrapper>
                  <TagValue>
                    {tag.key === 'release' ? (
                      <Version version={tagValue.name} anchor={false} />
                    ) : (
                      <DeviceName value={tagValue.name} />
                    )}
                  </TagValue>
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
    </div>
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

const TagPanel = styled(Link)`
  display: block;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  padding: ${space(1)};

  &:hover > h5 {
    text-decoration: underline;
  }
`;

const TagHeader = styled('h5')`
  grid-area: header;
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(0.5)};
  color: ${p => p.theme.textColor};
`;

const TagTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  ${p => p.theme.overflowEllipsis}
`;

// The 40px is a buffer to prevent percentages from overflowing
const progressBarWidth = '45px';
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
  margin-right: ${space(0.5)};
`;

const TagBarPlaceholder = styled('div')`
  position: relative;
  height: ${space(1)};
  width: 100%;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px ${p => p.theme.translucentBorder};
  background: ${p => Color(p.theme.gray300).alpha(0.1).toString()};
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
      `linear-gradient(to right, ${Color(p.theme.gray300).alpha(0.5).toString()} 0px, ${Color(p.theme.gray300).alpha(0.7).toString()} ${progressBarWidth})`};
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
