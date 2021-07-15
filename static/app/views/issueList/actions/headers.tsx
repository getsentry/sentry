import {Fragment} from 'react';
import styled from '@emotion/styled';

import ToolbarHeader from 'app/components/toolbarHeader';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection} from 'app/types';

type Props = {
  selection: GlobalSelection;
  statsPeriod: string;
  onSelectStatsPeriod: (statsPeriod: string) => void;
  isReprocessingQuery: boolean;
  anySelected?: boolean;
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
          <GraphHeaderWrapper className="hidden-xs hidden-sm hidden-md">
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
          <AssigneesLabel className="hidden-xs hidden-sm">
            <ToolbarHeader>{t('Assignee')}</ToolbarHeader>
          </AssigneesLabel>
        </Fragment>
      )}
    </Fragment>
  );
}

export default Headers;

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

// Reprocessing
const StartedColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};
  ${overflowEllipsis};
  width: 85px;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 140px;
  }
`;

const EventsReprocessedColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};
  ${overflowEllipsis};
  width: 75px;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    width: 140px;
  }
`;

const ProgressColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};

  display: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
    width: 160px;
  }
`;
