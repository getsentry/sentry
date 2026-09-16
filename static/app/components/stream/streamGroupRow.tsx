import {Fragment, type ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex} from '@sentry/scraps/layout';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {Placeholder} from 'sentry/components/placeholder';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';

const DEFAULT_COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'priority',
  'assignee',
  'lastTriggered',
];

interface StreamGroupRowProps {
  summary: ReactNode;
  assignee?: ReactNode;
  chart?: ReactNode;
  checkbox?: ReactNode;
  eventCount?: ReactNode;
  firstSeen?: ReactNode;
  lastSeen?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  priority?: ReactNode;
  progress?: ReactNode;
  reprocessing?: ReactNode;
  reviewed?: boolean;
  showChart?: boolean;
  statsEnabled?: boolean;
  useTintRow?: boolean;
  userCount?: ReactNode;
  withColumns?: GroupListColumn[];
}

/**
 * Pure layout component for a single issue row in the stream.
 *
 * Renders the responsive column grid with breakpoint-driven visibility.
 * All content is passed via slots — this component has no data dependencies,
 * no hooks, and no API calls.
 */
export function StreamGroupRow({
  summary,
  checkbox,
  chart,
  eventCount,
  userCount,
  priority,
  assignee,
  progress,
  firstSeen,
  lastSeen,
  reprocessing,
  onClick,
  reviewed = false,
  useTintRow = true,
  showChart = true,
  statsEnabled = true,
  withColumns = DEFAULT_COLUMNS,
}: StreamGroupRowProps) {
  const hasCheckbox = checkbox !== undefined;

  return (
    <Wrapper
      data-test-id="group"
      data-test-reviewed={reviewed}
      onClick={onClick}
      reviewed={reviewed}
      useTintRow={useTintRow}
    >
      <InteractionStateLayer />
      {hasCheckbox && checkbox}
      <GroupSummary canSelect={hasCheckbox}>{summary}</GroupSummary>

      {withColumns.includes('lastSeen') && (
        <Flex
          display={{zero: 'none', [COLUMN_BREAKPOINTS.LAST_SEEN]: 'flex'}}
          width="86px"
          paddingRight="xl"
          marginRight="xl"
          align="center"
          justify="end"
        >
          {lastSeen ?? <Placeholder height="18px" width="70px" />}
        </Flex>
      )}

      {withColumns.includes('firstSeen') && (
        <Flex
          display={{zero: 'none', [COLUMN_BREAKPOINTS.FIRST_SEEN]: 'flex'}}
          width="50px"
          paddingRight="xl"
          marginRight="xl"
          align="center"
          justify="end"
        >
          {firstSeen ?? <Placeholder height="18px" width="30px" />}
        </Flex>
      )}

      {showChart && !reprocessing && (
        <Container
          display={{zero: 'none', [COLUMN_BREAKPOINTS.TREND]: 'block'}}
          width="175px"
          alignSelf="center"
          marginRight="xl"
        >
          {statsEnabled ? (chart ?? <Placeholder height="36px" />) : null}
        </Container>
      )}

      {reprocessing ?? (
        <Fragment>
          {withColumns.includes('event') && (
            <Flex
              display={{zero: 'none', [COLUMN_BREAKPOINTS.EVENTS]: 'flex'}}
              alignSelf="center"
              paddingRight="xl"
              marginRight="xl"
              width="60px"
              align="center"
              justify="end"
            >
              {statsEnabled
                ? (eventCount ?? <Placeholder height="18px" width="40px" />)
                : null}
            </Flex>
          )}
          {withColumns.includes('users') && (
            <Flex
              display={{zero: 'none', [COLUMN_BREAKPOINTS.USERS]: 'flex'}}
              alignSelf="center"
              paddingRight="xl"
              marginRight="xl"
              width="60px"
              align="center"
              justify="end"
            >
              {statsEnabled
                ? (userCount ?? <Placeholder height="18px" width="40px" />)
                : null}
            </Flex>
          )}
          {withColumns.includes('priority') && (
            <Flex
              display={{zero: 'none', [COLUMN_BREAKPOINTS.PRIORITY]: 'flex'}}
              width="64px"
              paddingRight="xl"
              marginRight="xl"
              alignSelf="center"
              justify="end"
            >
              {priority}
            </Flex>
          )}
          {withColumns.includes('progress') && (
            <Flex
              display={{zero: 'none', [COLUMN_BREAKPOINTS.PROGRESS]: 'flex'}}
              width="124px"
              paddingRight="xl"
              marginRight="xl"
              alignSelf="center"
              justify="start"
            >
              {progress ?? <Placeholder height="18px" />}
            </Flex>
          )}
          {withColumns.includes('assignee') && (
            <Flex
              display={{zero: 'none', [COLUMN_BREAKPOINTS.ASSIGNEE]: 'flex'}}
              alignSelf="center"
              width="66px"
              paddingRight="xl"
              marginRight="xl"
              justify="end"
              style={{textAlign: 'right'}}
            >
              {assignee}
            </Flex>
          )}
        </Fragment>
      )}
    </Wrapper>
  );
}

const Wrapper = styled(PanelItem)<{
  reviewed: boolean;
  useTintRow: boolean;
}>`
  position: relative;
  line-height: 1.1;
  padding: ${p => p.theme.space.md} 0;
  min-height: 82px;

  ${p =>
    p.useTintRow &&
    p.reviewed &&
    css`
      animation: tintRow 0.2s linear forwards;
      position: relative;

      &:after {
        content: '';
        pointer-events: none;
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        background-color: ${p.theme.tokens.background.secondary};
        opacity: 0.4;
      }

      @keyframes tintRow {
        0% {
          background-color: ${p.theme.tokens.background.secondary};
        }
        100% {
          background-color: ${p.theme.tokens.background.secondary};
        }
      }
    `}
`;

const GroupSummary = styled('div')<{canSelect: boolean}>`
  overflow: hidden;
  margin-left: ${p => (p.canSelect ? p.theme.space.md : p.theme.space.xl)};
  margin-right: ${p => p.theme.space['3xl']};
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: ${p => p.theme.font.size.md};
  width: auto;
`;
