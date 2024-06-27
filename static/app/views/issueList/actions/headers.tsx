import {Fragment} from 'react';
import styled from '@emotion/styled';

import ToolbarHeader from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';

type Props = {
  isReprocessingQuery: boolean;
  onSelectStatsPeriod: (statsPeriod: string) => void;
  selection: PageFilters;
  statsPeriod: string;
  isSavedSearchesOpen?: boolean;
};

function Headers({
  selection,
  statsPeriod,
  onSelectStatsPeriod,
  isReprocessingQuery,
  isSavedSearchesOpen,
}: Props) {
  return (
    <Fragment>
      {isReprocessingQuery ? (
        <Fragment>
          <StartedColumn>{t('Started')}</StartedColumn>
          <EventsReprocessedColumn>{t('Events Reprocessed')}</EventsReprocessedColumn>
          <ProgressColumn>{t('Progress')}</ProgressColumn>
        </Fragment>
      ) : (
        <Fragment>
          <GraphHeaderWrapper isSavedSearchesOpen={isSavedSearchesOpen}>
            <GraphHeader>
              <StyledToolbarHeader>{t('Graph:')}</StyledToolbarHeader>
              {selection.datetime.period !== '24h' && (
                <GraphToggle
                  active={statsPeriod === '24h'}
                  onClick={() => onSelectStatsPeriod('24h')}
                >
                  {t('24h')}
                </GraphToggle>
              )}
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
          <PriorityLabel isSavedSearchesOpen={isSavedSearchesOpen}>
            <ToolbarHeader>{t('Priority')}</ToolbarHeader>
          </PriorityLabel>
          <AssigneeLabel isSavedSearchesOpen={isSavedSearchesOpen}>
            <ToolbarHeader>{t('Assignee')}</ToolbarHeader>
          </AssigneeLabel>
        </Fragment>
      )}
    </Fragment>
  );
}

export default Headers;

const GraphHeaderWrapper = styled('div')<{isSavedSearchesOpen?: boolean}>`
  width: 160px;
  margin-left: ${space(2)};
  margin-right: ${space(2)};

  /* prettier-ignore */
  @media (max-width: ${p =>
    p.isSavedSearchesOpen ? p.theme.breakpoints.xlarge : p.theme.breakpoints.large}) {
    display: none;
  }
`;

const GraphHeader = styled('div')`
  display: flex;
`;

const StyledToolbarHeader = styled(ToolbarHeader)`
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

const EventsOrUsersLabel = styled(ToolbarHeader)`
  display: inline-grid;
  align-items: center;
  justify-content: flex-end;
  text-align: right;
  width: 60px;
  margin: 0 ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    width: 80px;
  }
`;

const PriorityLabel = styled(ToolbarHeader)<{isSavedSearchesOpen?: boolean}>`
  justify-content: flex-end;
  text-align: right;
  width: 70px;
  margin: 0 ${space(2)};

  /* prettier-ignore */
  @media (max-width: ${p =>
    p.isSavedSearchesOpen ? p.theme.breakpoints.large : p.theme.breakpoints.medium}) {
    display: none;
  }
`;

const AssigneeLabel = styled(ToolbarHeader)<{isSavedSearchesOpen?: boolean}>`
  justify-content: flex-end;
  text-align: right;
  width: 60px;
  margin-left: ${space(2)};
  margin-right: ${space(2)};

  /* prettier-ignore */
  @media (max-width: ${p =>
    p.isSavedSearchesOpen ? p.theme.breakpoints.large : p.theme.breakpoints.medium}) {
    display: none;
  }
`;

// Reprocessing
const StartedColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};
  ${p => p.theme.overflowEllipsis};
  width: 85px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 140px;
  }
`;

const EventsReprocessedColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};
  ${p => p.theme.overflowEllipsis};
  width: 75px;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 140px;
  }
`;

const ProgressColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};

  display: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
    width: 160px;
  }
`;
