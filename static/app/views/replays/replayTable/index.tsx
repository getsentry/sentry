import {Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelTable from 'sentry/components/panels/panelTable';
import {t, tct} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
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

export const MIN_DEAD_RAGE_CLICK_SDK = '7.60.1';

type Props = {
  fetchError: undefined | Error;
  isFetching: boolean;
  replays: undefined | ReplayListRecord[] | ReplayListRecordWithTx[];
  sort: Sort | undefined;
  visibleColumns: ReplayColumn[];
  emptyMessage?: ReactNode;
  gridRows?: string;
  saveLocation?: boolean;
};

function ReplayTable({
  fetchError,
  isFetching,
  replays,
  sort,
  visibleColumns,
  emptyMessage,
  saveLocation,
  gridRows,
}: Props) {
  const routes = useRoutes();
  const newLocation = useLocation();
  const organization = useOrganization();

  const {
    selection: {projects},
  } = usePageFilters();

  const needSDKUpgrade = useProjectSdkNeedsUpdate({
    minVersion: MIN_DEAD_RAGE_CLICK_SDK,
    organization,
    projectId: projects.map(String),
  });

  const location: Location = saveLocation
    ? {
        pathname: '',
        search: '',
        query: {},
        hash: '',
        state: '',
        action: 'PUSH',
        key: '',
      }
    : newLocation;

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

  if (
    needSDKUpgrade.needsUpdate &&
    (visibleColumns.includes(ReplayColumn.MOST_DEAD_CLICKS) ||
      visibleColumns.includes(ReplayColumn.MOST_RAGE_CLICKS))
  ) {
    return (
      <StyledPanelTable
        headers={tableHeaders}
        visibleColumns={visibleColumns}
        data-test-id="replay-table"
        gridRows={undefined}
        loader={<LoadingIndicator style={{margin: '54px auto'}} />}
        disablePadding
      >
        <StyledAlert type="info" showIcon>
          {tct('[data] requires [sdkPrompt]. [link:Upgrade now.]', {
            data: <strong>Rage and dead clicks</strong>,
            sdkPrompt: <strong>{t('SDK version >= 7.60.1')}</strong>,
            link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
          })}
        </StyledAlert>
      </StyledPanelTable>
    );
  }

  const referrer = getRouteStringFromRoutes(routes);
  const eventView = EventView.fromLocation(location);

  return (
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
      {replays?.map(replay => {
        return (
          <Fragment key={replay.id}>
            {visibleColumns.map(column => {
              switch (column) {
                case ReplayColumn.ACTIVITY:
                  return <ActivityCell key="activity" replay={replay} />;

                case ReplayColumn.BROWSER:
                  return <BrowserCell key="browser" replay={replay} />;

                case ReplayColumn.COUNT_DEAD_CLICKS:
                  return <DeadClickCountCell key="countDeadClicks" replay={replay} />;

                case ReplayColumn.COUNT_DEAD_CLICKS_NO_HEADER:
                  return <DeadClickCountCell key="countDeadClicks" replay={replay} />;

                case ReplayColumn.COUNT_ERRORS:
                  return <ErrorCountCell key="countErrors" replay={replay} />;

                case ReplayColumn.COUNT_RAGE_CLICKS:
                  return <RageClickCountCell key="countRageClicks" replay={replay} />;

                case ReplayColumn.COUNT_RAGE_CLICKS_NO_HEADER:
                  return <RageClickCountCell key="countRageClicks" replay={replay} />;

                case ReplayColumn.DURATION:
                  return <DurationCell key="duration" replay={replay} />;

                case ReplayColumn.OS:
                  return <OSCell key="os" replay={replay} />;

                case ReplayColumn.REPLAY:
                  return (
                    <ReplayCell
                      key="session"
                      replay={replay}
                      eventView={eventView}
                      organization={organization}
                      referrer={referrer}
                      showUrl
                      referrer_table="main"
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

                case ReplayColumn.MOST_RAGE_CLICKS:
                  return (
                    <ReplayCell
                      key="mostRageClicks"
                      replay={replay}
                      organization={organization}
                      referrer={referrer}
                      showUrl={false}
                      eventView={eventView}
                      referrer_table="rage-table"
                    />
                  );

                case ReplayColumn.MOST_DEAD_CLICKS:
                  return (
                    <ReplayCell
                      key="mostDeadClicks"
                      replay={replay}
                      organization={organization}
                      referrer={referrer}
                      showUrl={false}
                      eventView={eventView}
                      referrer_table="dead-table"
                    />
                  );

                case ReplayColumn.MOST_ERRONEOUS_REPLAYS:
                  return (
                    <ReplayCell
                      key="mostErroneousReplays"
                      replay={replay}
                      organization={organization}
                      referrer={referrer}
                      showUrl={false}
                      eventView={eventView}
                      referrer_table="errors-table"
                    />
                  );

                default:
                  return null;
              }
            })}
          </Fragment>
        );
      })}
    </StyledPanelTable>
  );
}

const flexibleColumns = [
  ReplayColumn.REPLAY,
  ReplayColumn.MOST_RAGE_CLICKS,
  ReplayColumn.MOST_DEAD_CLICKS,
  ReplayColumn.MOST_ERRONEOUS_REPLAYS,
];

const StyledPanelTable = styled(PanelTable)<{
  visibleColumns: ReplayColumn[];
  gridRows?: string;
}>`
  ${props =>
    props.visibleColumns.includes(ReplayColumn.MOST_RAGE_CLICKS) ||
    props.visibleColumns.includes(ReplayColumn.MOST_DEAD_CLICKS) ||
    props.visibleColumns.includes(ReplayColumn.MOST_ERRONEOUS_REPLAYS)
      ? `border-bottom-left-radius: 0; border-bottom-right-radius: 0;`
      : ``}
  margin-bottom: 0;
  grid-template-columns: ${p =>
    p.visibleColumns
      .filter(Boolean)
      .map(column =>
        flexibleColumns.includes(column) ? 'minmax(100px, 1fr)' : 'max-content'
      )
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

export default ReplayTable;
