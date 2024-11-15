import {type CSSProperties, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {DeviceName} from 'sentry/components/deviceName';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {percent} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function TagDistribution({tag}: {tag: GroupTag}) {
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <TagHeader>
        <Tooltip title={tag.key} showOnlyOnOverflow skipWrapper>
          <TagTitle>{tag.key}</TagTitle>
        </Tooltip>
        <TagDetailsButton
          borderless
          size="zero"
          to={{
            pathname: `${location.pathname}${tag.key}/`,
            query: location.query,
            replace: true,
          }}
          isVisible={isHovered}
        >
          {t('Details')}
        </TagDetailsButton>
      </TagHeader>
      <TagValueContent>
        {tag.topValues.map((tagValue, tagValueIdx) => (
          <TagValueRow key={tagValueIdx}>
            <Tooltip delay={300} title={tagValue.name} skipWrapper>
              <TagValue
                to={{
                  pathname: `${baseUrl}${TabPaths[Tab.EVENTS]}`,
                  query: {
                    ...location.query,
                    query: tagValue.query || `${tag.key}:"${tagValue.value}"`,
                  },
                }}
              >
                {tag.key === 'release' ? (
                  <Version version={tagValue.name} anchor={false} />
                ) : (
                  <DeviceName value={tagValue.name} />
                )}
              </TagValue>
            </Tooltip>
            <TagBar count={tagValue.count} total={tag.totalValues} />
          </TagValueRow>
        ))}
      </TagValueContent>
    </div>
  );
}

export function TagBar({
  count,
  total,
  ...props
}: {
  count: number;
  total: number;
  className?: string;
  style?: CSSProperties;
}) {
  const percentage = percent(count, total);
  const displayPercentage = percentage < 1 ? '<1%' : `${percentage.toFixed(0)}%`;
  return (
    <Tooltip delay={300} title={`${count} / ${total}`} skipWrapper>
      <TagBarContainer
        displayPercentage={displayPercentage}
        widthPercent={percentage}
        {...props}
      >
        <TagBarValue>{displayPercentage}</TagBarValue>
      </TagBarContainer>
    </Tooltip>
  );
}

const TagHeader = styled('div')`
  grid-area: header;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
  margin-bottom: ${space(1)};
`;

const TagTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  ${p => p.theme.overflowEllipsis}
`;

const TagDetailsButton = styled(LinkButton)<{isVisible: boolean}>`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => (p.isVisible ? p.theme.subText : 'transparent')};
`;

// The 40px is a buffer to prevent percentages from overflowing
const TagValueContent = styled('div')`
  display: grid;
  grid-template-columns: 50% 1fr 40px;
  color: ${p => p.theme.subText};
`;

const TagValueRow = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
`;

const TagValue = styled(Link)`
  display: block;
  text-align: right;
  color: ${p => p.theme.subText};
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  margin-right: ${space(1)};
  justify-self: end;
  max-width: calc(100% - ${space(2)});
`;

const TagBarContainer = styled('div')<{displayPercentage: string; widthPercent: number}>`
  height: ${space(1)};
  position: relative;
  flex: 1;
  width: calc(${p => p.widthPercent}%);
  min-width: ${space(1)};
  display: flex;
  align-items: center;
  &:before {
    position: absolute;
    inset: 0;
    content: '';
    border-radius: 1000px;
    background: ${p => p.theme.border};
    border: 1px solid ${p => p.theme.translucentBorder};
    width: 100%;
  }
`;

const TagBarValue = styled('div')`
  margin-left: 100%;
  padding-left: ${space(0.5)};

  color: ${p => p.theme.subText};
`;
