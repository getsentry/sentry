import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import IssueStreamHeaderLabel from 'sentry/components/IssueStreamHeaderLabel';
import ToolbarHeader from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';

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
          <LastSeenLabel breakpoint={COLUMN_BREAKPOINTS.LAST_SEEN} align="right">
            {t('Last Seen')}
          </LastSeenLabel>
          <FirstSeenLabel breakpoint={COLUMN_BREAKPOINTS.FIRST_SEEN} align="right">
            {t('Age')}
          </FirstSeenLabel>
          <GraphLabel breakpoint={COLUMN_BREAKPOINTS.TREND}>
            <Flex flex="1" justify="between">
              {t('Trend')}
              <GraphToggles>
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
              </GraphToggles>
            </Flex>
          </GraphLabel>
          <EventsOrUsersLabel breakpoint={COLUMN_BREAKPOINTS.EVENTS} align="right">
            {t('Events')}
          </EventsOrUsersLabel>
          <EventsOrUsersLabel breakpoint={COLUMN_BREAKPOINTS.USERS} align="right">
            {t('Users')}
          </EventsOrUsersLabel>
          <PriorityLabel breakpoint={COLUMN_BREAKPOINTS.PRIORITY} align="left">
            {t('Priority')}
          </PriorityLabel>
          <AssigneeLabel breakpoint={COLUMN_BREAKPOINTS.ASSIGNEE} align="right">
            {t('Assignee')}
          </AssigneeLabel>
        </Fragment>
      )}
    </Fragment>
  );
}

export default Headers;

const GraphLabel = styled(IssueStreamHeaderLabel)`
  width: 175px;
  flex: 1;
  display: flex;
  justify-content: space-between;
  padding: 0;
`;

const GraphToggles = styled('div')`
  font-weight: ${p => p.theme.fontWeight.normal};
  margin-right: ${space(2)};
`;

const GraphToggle = styled('a')<{active: boolean}>`
  font-size: 13px;
  padding-left: ${space(1)};

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p => (p.active ? p.theme.tokens.content.primary : p.theme.disabled)};
  }
`;

const LastSeenLabel = styled(IssueStreamHeaderLabel)`
  width: 86px;
`;

const FirstSeenLabel = styled(IssueStreamHeaderLabel)`
  width: 50px;
`;

const EventsOrUsersLabel = styled(IssueStreamHeaderLabel)`
  width: 60px;
`;

const PriorityLabel = styled(IssueStreamHeaderLabel)`
  width: 64px;
`;

const AssigneeLabel = styled(IssueStreamHeaderLabel)`
  width: 66px;
`;

// Reprocessing
const StartedColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};
  ${p => p.theme.overflowEllipsis};
  width: 85px;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 140px;
  }
`;

const EventsReprocessedColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};
  ${p => p.theme.overflowEllipsis};
  width: 75px;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 140px;
  }
`;

const ProgressColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};

  display: none;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
    width: 160px;
  }
`;
