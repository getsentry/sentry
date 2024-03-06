import type {ReactNode} from 'react';
import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {REPLAY_LOADING_HEIGHT_LARGE} from 'sentry/components/events/eventReplay/constants';
import LazyLoad from 'sentry/components/lazyLoad';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
// import {getAnalyticsDataForEvent, getAnalyticsDataForGroup} from 'sentry/utils/events';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import type {ReplayListRecordWithTx} from 'sentry/views/performance/transactionSummary/transactionReplays/useReplaysWithTxData';
import HeaderCell from 'sentry/views/replays/replayTable/headerCell';
import {
  ActivityCell,
  BrowserCell,
  DeadClickCountCell,
  DurationCell,
  ErrorCountCell,
  OSCell,
  RageClickCountCell,
  ReplayCell,
  TransactionCell,
} from 'sentry/views/replays/replayTable/tableCell';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListRecord} from 'sentry/views/replays/types';

type AdditionalProps =
  | {
      group: Group;
      showReplayPlayer: true;
    }
  | {
      group?: undefined;
      showReplayPlayer?: false;
    };

type Props = {
  fetchError: undefined | Error;
  isFetching: boolean;
  replays: undefined | ReplayListRecord[] | ReplayListRecordWithTx[];
  sort: Sort | undefined;
  visibleColumns: ReplayColumn[];
  emptyMessage?: ReactNode;
  gridRows?: string;
  showDropdownFilters?: boolean;
} & AdditionalProps;

function ReplayTable({
  fetchError,
  isFetching,
  replays,
  sort,
  visibleColumns,
  emptyMessage,
  gridRows,
  showDropdownFilters,
  group,
  showReplayPlayer,
}: Props) {
  const routes = useRoutes();
  const location = useLocation();
  const organization = useOrganization();

  const replayClipPreview = useCallback(
    () => import('sentry/components/events/eventReplay/replayClipPreview'),
    []
  );

  const [selectedReplayIndex, setSelectedReplayIndex] = useState<number>(0);
  const selectedReplay = replays?.[selectedReplayIndex];

  const nextReplay = replays?.[selectedReplayIndex + 1];
  const nextReplayText = nextReplay?.id
    ? `${nextReplay.user.display_name || t('Anonymous User')}`
    : undefined;

  const tableHeaders = visibleColumns
    .filter(Boolean)
    .map(column => <HeaderCell key={column} column={column} sort={sort} />);

  if (fetchError && !isFetching) {
    return (
      <StyledPanelTable
        headers={tableHeaders}
        isLoading={false}
        visibleColumns={visibleColumns}
        data-test-id="replay-table"
        gridRows={undefined}
      >
        <StyledAlert type="error" showIcon>
          {typeof fetchError === 'string'
            ? fetchError
            : t(
                'Sorry, the list of replays could not be loaded. This could be due to invalid search parameters or an internal systems error.'
              )}
        </StyledAlert>
      </StyledPanelTable>
    );
  }

  const referrer = getRouteStringFromRoutes(routes);
  const eventView = EventView.fromLocation(location);

  const commonProps = {
    analyticsContext: 'replay_tab',
    orgSlug: organization.slug,
    fullReplayButtonProps: {
      analyticsEventKey: 'issue_details.open_replay_details_clicked',
      analyticsEventName: 'Issue Details: Open Replay Details Clicked',
      analyticsParams: {
        source: 'replay_tab',
        organization,
      },
    },
    loadingFallback: (
      <StyledNegativeSpaceContainer testId="replay-loading-placeholder">
        <LoadingIndicator />
      </StyledNegativeSpaceContainer>
    ),
  };

  const handleBackClick =
    selectedReplayIndex > 0 ? () => setSelectedReplayIndex(prev => prev - 1) : undefined;

  const handleForwardClick =
    replays?.length && selectedReplayIndex < replays.length - 1
      ? () => setSelectedReplayIndex(prev => prev + 1)
      : undefined;

  return (
    <div>
      {selectedReplay && showReplayPlayer && (
        <ReplayWrapper>
          <StyledLazyLoad
            {...commonProps}
            component={replayClipPreview}
            replaySlug={selectedReplay.id}
            handleBackClick={handleBackClick}
            handleForwardClick={handleForwardClick}
            overlayText={nextReplayText}
            isLarge
            group={group}
          />
        </ReplayWrapper>
      )}
      <StyledPanelTable
        headers={tableHeaders}
        isEmpty={replays?.length === 0}
        isLoading={isFetching}
        visibleColumns={visibleColumns}
        disablePadding
        data-test-id="replay-table"
        emptyMessage={emptyMessage}
        gridRows={isFetching ? undefined : gridRows}
        loader={<LoadingIndicator style={{margin: '54px auto'}} />}
      >
        {replays?.map(
          (replay: ReplayListRecord | ReplayListRecordWithTx, index: number) => {
            return (
              <Fragment key={replay.id}>
                {visibleColumns.map(column => {
                  switch (column) {
                    case ReplayColumn.ACTIVITY:
                      return (
                        <ActivityCell
                          key="activity"
                          replay={replay}
                          showDropdownFilters={showDropdownFilters}
                        />
                      );

                    case ReplayColumn.BROWSER:
                      return (
                        <BrowserCell
                          key="browser"
                          replay={replay}
                          showDropdownFilters={showDropdownFilters}
                        />
                      );

                    case ReplayColumn.COUNT_DEAD_CLICKS:
                      return (
                        <DeadClickCountCell
                          key="countDeadClicks"
                          replay={replay}
                          showDropdownFilters={showDropdownFilters}
                        />
                      );

                    case ReplayColumn.COUNT_ERRORS:
                      return (
                        <ErrorCountCell
                          key="countErrors"
                          replay={replay}
                          showDropdownFilters={showDropdownFilters}
                        />
                      );

                    case ReplayColumn.COUNT_RAGE_CLICKS:
                      return (
                        <RageClickCountCell
                          key="countRageClicks"
                          replay={replay}
                          showDropdownFilters={showDropdownFilters}
                        />
                      );

                    case ReplayColumn.DURATION:
                      return (
                        <DurationCell
                          key="duration"
                          replay={replay}
                          showDropdownFilters={showDropdownFilters}
                        />
                      );

                    case ReplayColumn.OS:
                      return (
                        <OSCell
                          key="os"
                          replay={replay}
                          showDropdownFilters={showDropdownFilters}
                        />
                      );

                    case ReplayColumn.REPLAY:
                      return (
                        <ReplayCell
                          key="session"
                          replay={replay}
                          eventView={eventView}
                          organization={organization}
                          referrer={referrer}
                          referrer_table="main"
                          handleClick={() =>
                            showReplayPlayer && setSelectedReplayIndex(index)
                          }
                          hasCurrentlyPlayingTag={
                            showReplayPlayer && index === selectedReplayIndex
                          }
                        />
                      );

                    case ReplayColumn.SLOWEST_TRANSACTION:
                      return (
                        <TransactionCell
                          key="slowestTransaction"
                          replay={replay}
                          organization={organization}
                        />
                      );

                    default:
                      return null;
                  }
                })}
              </Fragment>
            );
          }
        )}
      </StyledPanelTable>
    </div>
  );
}

const StyledPanelTable = styled(PanelTable)<{
  visibleColumns: ReplayColumn[];
  gridRows?: string;
}>`
  margin-bottom: 0;
  grid-template-columns: ${p =>
    p.visibleColumns
      .filter(Boolean)
      .map(column => (column === 'replay' ? 'minmax(100px, 1fr)' : 'max-content'))
      .join(' ')};
  ${props =>
    props.gridRows
      ? `grid-template-rows: ${props.gridRows};`
      : `grid-template-rows: 44px max-content;`}
`;

const StyledAlert = styled(Alert)`
  border-radius: 0;
  border-width: 1px 0 0 0;
  grid-column: 1/-1;
  margin-bottom: 0;
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT_LARGE}px;
  margin-bottom: ${space(2)};
`;

const ReplayWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledLazyLoad = styled(LazyLoad)``;

export default ReplayTable;
