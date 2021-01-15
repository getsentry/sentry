import React from 'react';
import styled from '@emotion/styled';

import QueryCount from 'app/components/queryCount';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection} from 'app/types';

type Props = {
  selection: GlobalSelection;
  statsPeriod: string;
  pageCount: number;
  queryCount: number;
  queryMaxCount: number;
  onSelectStatsPeriod: (statsPeriod: string) => void;
  isReprocessingQuery: boolean;
  hasInbox?: boolean;
  anySelected?: boolean;
};

function Headers({
  anySelected,
  selection,
  statsPeriod,
  pageCount,
  queryCount,
  queryMaxCount,
  onSelectStatsPeriod,
  isReprocessingQuery,
  hasInbox,
}: Props) {
  return (
    <React.Fragment>
      {hasInbox && !anySelected && (
        <ActionSetPlaceholder>
          {/* total includes its own space */}
          {tct('Select [count] of [total]', {
            count: <React.Fragment>{pageCount}</React.Fragment>,
            total: (
              <QueryCount
                hideParens
                hideIfEmpty={false}
                count={queryCount || 0}
                max={queryMaxCount || 1}
              />
            ),
          })}
        </ActionSetPlaceholder>
      )}
      {isReprocessingQuery ? (
        <React.Fragment>
          <StartedColumn>{t('Started')}</StartedColumn>
          <EventsReprocessedColumn>{t('Events Reprocessed')}</EventsReprocessedColumn>
          <ProgressColumn>{t('Progress')}</ProgressColumn>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <GraphHeaderWrapper
            className={`hidden-xs hidden-sm ${hasInbox ? 'hidden-md' : ''}`}
          >
            <GraphHeader>
              <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
              <GraphToggle
                active={statsPeriod === '24h'}
                onClick={() => onSelectStatsPeriod('24h')}
              >
                {t('24h')}
              </GraphToggle>
              <GraphToggle
                active={statsPeriod === 'auto'}
                onClick={() => onSelectStatsPeriod('auto')}
              >
                {selection.datetime.period || t('Custom')}
              </GraphToggle>
            </GraphHeader>
          </GraphHeaderWrapper>
          <EventsOrUsersLabel>{t('Events')}</EventsOrUsersLabel>
          <EventsOrUsersLabel>{t('Users')}</EventsOrUsersLabel>
          <AssigneesLabel className="hidden-xs hidden-sm">
            <IssueToolbarHeader>{t('Assignee')}</IssueToolbarHeader>
          </AssigneesLabel>
          {hasInbox && (
            <ActionsLabel>
              <IssueToolbarHeader>{t('Actions')}</IssueToolbarHeader>
            </ActionsLabel>
          )}
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

export default Headers;

const IssueToolbarHeader = styled(ToolbarHeader)`
  animation: 0.3s FadeIn linear forwards;

  @keyframes FadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;

const ActionSetPlaceholder = styled(IssueToolbarHeader)`
  @media (min-width: 800px) {
    width: 66.66666666666666%;
  }
  @media (min-width: 992px) {
    width: 50%;
  }

  flex: 1;
  margin-left: ${space(1)};
  margin-right: ${space(1)};
  overflow: hidden;
  min-width: 0;
  white-space: nowrap;
`;

const GraphHeaderWrapper = styled('div')`
  width: 160px;
  margin-left: ${space(2)};
  margin-right: ${space(2)};
  animation: 0.25s FadeIn linear forwards;

  @keyframes FadeIn {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
`;

const GraphHeader = styled('div')`
  display: flex;
`;

const StyledToolbarHeader = styled(IssueToolbarHeader)`
  flex: 1;
`;

const GraphToggle = styled('a')<{active: boolean}>`
  font-size: 13px;
  padding-left: ${space(1)};

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => (p.active ? p.theme.textColor : p.theme.disabled)};
  }
`;

const EventsOrUsersLabel = styled(IssueToolbarHeader)`
  display: inline-grid;
  align-items: center;
  justify-content: flex-end;
  text-align: right;
  width: 60px;
  margin: 0 ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    width: 80px;
  }
`;

const AssigneesLabel = styled('div')`
  justify-content: flex-end;
  text-align: right;
  width: 80px;
  margin-left: ${space(2)};
  margin-right: ${space(2)};
`;

const ActionsLabel = styled('div')`
  justify-content: flex-end;
  text-align: right;
  width: 80px;
  margin: 0 ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[3]}) {
    display: none;
  }
`;

// Reprocessing
const StartedColumn = styled(IssueToolbarHeader)`
  margin: 0 ${space(2)};
  ${overflowEllipsis};
  width: 85px;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 140px;
  }
`;

const EventsReprocessedColumn = styled(IssueToolbarHeader)`
  margin: 0 ${space(2)};
  ${overflowEllipsis};
  width: 75px;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 140px;
  }
`;

const ProgressColumn = styled(IssueToolbarHeader)`
  margin: 0 ${space(2)};

  display: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
    width: 160px;
  }
`;
