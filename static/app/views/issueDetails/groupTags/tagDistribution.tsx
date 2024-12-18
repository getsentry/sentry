import styled from '@emotion/styled';
import Color from 'color';

import {DeviceName} from 'sentry/components/deviceName';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

export function TagDistribution({tag}: {tag: GroupTag}) {
  const location = useLocation();

  return (
    <div>
      <TagPanel
        to={{
          pathname: `${location.pathname}${tag.key}/`,
          query: location.query,
        }}
      >
        <TagHeader>
          <Tooltip title={tag.key} showOnlyOnOverflow skipWrapper>
            <TagTitle>{tag.key}</TagTitle>
          </Tooltip>
        </TagHeader>
        <TagValueContent>
          {tag.topValues.map((tagValue, tagValueIdx) => {
            const percentage = percent(tagValue.count, tag.totalValues);
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
  return <TagBarContainer style={{width: `${percentage}%`, ...style}} {...props} />;
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
const TagValueContent = styled('div')`
  display: grid;
  grid-template-columns: 4fr auto 45px;
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

const TagBarContainer = styled('div')`
  height: ${space(1)};
  position: relative;
  flex: 1;
  min-width: ${space(1)};
  display: flex;
  align-items: center;
  &:before {
    position: absolute;
    inset: 0;
    content: '';
    border-radius: 3px;
    background: ${p => Color(p.theme.gray300).alpha(0.5).toString()};
    border: 1px solid ${p => p.theme.translucentBorder};
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
