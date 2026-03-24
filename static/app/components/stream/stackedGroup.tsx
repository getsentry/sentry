import {useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import {IconChevron, IconFocus, IconStack} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface StackedGroupProps {
  groups: Group[];
  renderGroup: (group: Group) => React.ReactNode;
  supergroup: SupergroupDetail;
}

/**
 * Renders a visual "stack" of related issues that share a supergroup.
 *
 * Collapsed: shows the first issue with shadow cards peeking out below.
 * Expanded: shows all issues from the supergroup on the current page.
 */
export function StackedGroup({supergroup, groups, renderGroup}: StackedGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const totalIssueCount = supergroup.group_ids.length;
  const visibleCount = groups.length;
  const shadowDepth = expanded ? 0 : Math.min(totalIssueCount - 1, 2);

  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  return (
    <StackContainer>
      <StackHeaderButton onClick={handleToggle}>
        <HeaderContent>
          <AccentIcon size="xs" />
          <TitleText size="sm" bold>
            {supergroup.title}
          </TitleText>
          <CountBadge>
            {totalIssueCount > visibleCount
              ? t('%s of %s issues', visibleCount, totalIssueCount)
              : tn('%s issue', '%s issues', totalIssueCount)}
          </CountBadge>
          {supergroup.summary ? (
            <RootCauseHint>
              <IconFocus size="xs" />
              <RootCauseLabel size="xs" variant="muted">
                {supergroup.summary}
              </RootCauseLabel>
            </RootCauseHint>
          ) : null}
        </HeaderContent>
        <ExpandIcon size="xs" direction={expanded ? 'up' : 'down'} />
      </StackHeaderButton>

      <StackBody shadowDepth={shadowDepth}>
        {expanded ? groups.map(group => renderGroup(group)) : renderGroup(groups[0]!)}
      </StackBody>
    </StackContainer>
  );
}

const StackContainer = styled('div')`
  position: relative;
`;

const StackHeaderButton = styled('button')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.secondary};
  border: none;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  cursor: pointer;
  color: ${p => p.theme.tokens.content.secondary};
  font-family: inherit;
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.4;

  &:hover {
    background: ${p => p.theme.tokens.background.primary};
  }
`;

const HeaderContent = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  min-width: 0;
  overflow: hidden;
  flex: 1;
`;

const AccentIcon = styled(IconStack)`
  flex-shrink: 0;
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

const TitleText = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex-shrink: 1;
  color: ${p => p.theme.tokens.content.primary};
`;

const CountBadge = styled('span')`
  display: inline-flex;
  align-items: center;
  padding: 0 ${p => p.theme.space.sm};
  height: 18px;
  border-radius: 9px;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.xs};
  white-space: nowrap;
  flex-shrink: 0;
`;

const RootCauseHint = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  min-width: 0;
  overflow: hidden;
  flex-shrink: 1;
  color: ${p => p.theme.tokens.content.secondary};

  @container (width < 800px) {
    display: none;
  }
`;

const RootCauseLabel = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ExpandIcon = styled(IconChevron)`
  flex-shrink: 0;
  margin-left: ${p => p.theme.space.sm};
`;

const StackBody = styled('div')<{shadowDepth: number}>`
  position: relative;

  /* PanelItem removes border-bottom on :last-child — restore it so the
     bottom edge of the card connects cleanly to the shadow cards below */
  & > :last-child {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  ${p =>
    p.shadowDepth > 0 &&
    css`
      padding-bottom: ${p.shadowDepth * 6}px;

      &::before {
        content: '';
        position: absolute;
        bottom: ${p.shadowDepth > 1 ? '6px' : '0'};
        left: 8px;
        right: 8px;
        height: 5px;
        background: ${p.theme.tokens.background.primary};
        border: 1px solid ${p.theme.tokens.border.secondary};
        border-top: none;
        border-radius: 0 0 4px 4px;
      }

      ${p.shadowDepth > 1 &&
      css`
        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 16px;
          right: 16px;
          height: 5px;
          background: ${p.theme.tokens.background.primary};
          border: 1px solid ${p.theme.tokens.border.secondary};
          border-top: none;
          border-radius: 0 0 4px 4px;
        }
      `}
    `}
`;
