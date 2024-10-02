import {useState} from 'react';
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

export function TagDistribution({tag}: {tag: GroupTag}) {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <TagHeader>
        <TagTitle>{tag.key}</TagTitle>
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
        {tag.topValues.map((tagValue, tagValueIdx) => {
          const percentage = percent(tagValue.count, tag.totalValues);
          const displayPercentage = percentage < 1 ? '<1%' : `${Math.round(percentage)}%`;
          return (
            <TagValueRow key={tagValueIdx}>
              <Tooltip delay={300} title={tagValue.name} skipWrapper>
                <TagValue
                  to={{
                    pathname: `${location.pathname}${TabPaths[Tab.EVENTS]}`,
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
              <Tooltip
                delay={300}
                title={`${tagValue.count} / ${tag.totalValues} `}
                skipWrapper
              >
                <TagBar widthPercent={percentage} displayPercentage={displayPercentage} />
              </Tooltip>
            </TagValueRow>
          );
        })}
      </TagValueContent>
    </div>
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

const TagBar = styled('div')<{displayPercentage: string; widthPercent: number}>`
  height: ${space(1)};
  position: relative;
  flex: 1;
  width: calc(${p => p.widthPercent}%);
  min-width: ${space(1)};
  &:before {
    position: absolute;
    inset: 0;
    content: '';
    border-radius: 1000px;
    background: ${p => p.theme.border};
    border: 1px solid ${p => p.theme.translucentBorder};
    width: 100%;
  }
  &:after {
    position: absolute;
    left: 100%;
    top: 50%;
    content: '${p => p.displayPercentage}';
    line-height: 0;
    margin-left: ${space(0.5)};
  }
`;
