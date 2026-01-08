import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {BulkEditOperation} from 'sentry/actionCreators/monitors';
import {bulkEditMonitors} from 'sentry/actionCreators/monitors';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Text} from 'sentry/components/core/text';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import SearchBar from 'sentry/components/searchBar';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  MonitorSortOption,
  MonitorSortOrder,
  SortSelector,
} from 'sentry/views/insights/crons/components/overviewTimeline/sortSelector';
import type {Monitor} from 'sentry/views/insights/crons/types';
import {makeMonitorListQueryKey} from 'sentry/views/insights/crons/utils';
import {scheduleAsText} from 'sentry/views/insights/crons/utils/scheduleAsText';

interface Props extends ModalRenderProps {}

const NUM_PLACEHOLDER_ROWS = 7;

export function BulkEditMonitorsModal({Header, Body, Footer, closeModal}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const queryClient = useQueryClient();
  const api = useApi();

  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [sortSelection, setSortSelection] = useState<{
    order: MonitorSortOrder;
    sort: MonitorSortOption;
  }>({sort: MonitorSortOption.STATUS, order: MonitorSortOrder.ASCENDING});

  const queryKey = makeMonitorListQueryKey(organization, {
    ...location.query,
    query: searchQuery,
    cursor,
    sort: sortSelection.sort,
    asc: sortSelection.order,
  });

  const [selectedMonitors, setSelectedMonitors] = useState<Monitor[]>([]);
  const isMonitorSelected = (monitor: Monitor): boolean => {
    return selectedMonitors.some(m => m.slug === monitor.slug);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCursor(undefined);
  };

  const handleToggleMonitor = (monitor: Monitor) => {
    const checked = isMonitorSelected(monitor);
    if (checked) {
      setSelectedMonitors(selectedMonitors.filter(m => m.slug !== monitor.slug));
    } else {
      setSelectedMonitors([...selectedMonitors, monitor]);
    }
  };

  const handleBulkEdit = async (operation: BulkEditOperation) => {
    setIsUpdating(true);
    const resp = await bulkEditMonitors(
      api,
      organization.slug,
      selectedMonitors.map(monitor => monitor.id),
      operation
    );
    setSelectedMonitors([]);

    if (resp?.updated) {
      setApiQueryData<Monitor[]>(queryClient, queryKey, oldMonitorList => {
        return oldMonitorList?.map(
          monitor =>
            resp.updated.find(newMonitor => newMonitor.slug === monitor.slug) ?? monitor
        );
      });
    }
    setIsUpdating(false);
  };

  const {
    data: monitorList,
    getResponseHeader: monitorListHeaders,
    isPending,
  } = useApiQuery<Monitor[]>(queryKey, {
    staleTime: 0,
  });
  const monitorPageLinks = monitorListHeaders?.('Link');

  const headers = [t('Monitor'), t('State'), t('Muted'), t('Schedule')];
  const shouldDisable = selectedMonitors.every(monitor => monitor.status !== 'disabled');
  const shouldMute = selectedMonitors.every(monitor => !monitor.isMuted);

  const disableEnableBtnParams = {
    operation: {status: shouldDisable ? 'disabled' : 'active'} as BulkEditOperation,
    actionText: shouldDisable ? t('Disable') : t('Enable'),
    analyticsEventKey: 'crons_bulk_edit_modal.disable_enable_click',
    analyticsEventName: 'Crons Bulk Edit Modal: Disable Enable Click',
  };
  const muteUnmuteBtnParams = {
    operation: {isMuted: shouldMute ? true : false},
    actionText: shouldMute ? t('Mute') : t('Unmute'),
    analyticsEventKey: 'crons_bulk_edit_modal.mute_unmute_click',
    analyticsEventName: 'Crons Bulk Edit Modal: Mute Unmute Click',
  };

  return (
    <Fragment>
      <Header closeButton>
        <h3>{t('Manage Monitors')}</h3>
      </Header>
      <Body>
        <Actions>
          <ActionButtons>
            {[disableEnableBtnParams, muteUnmuteBtnParams].map(
              ({operation, actionText, ...analyticsProps}, i) => (
                <Button
                  key={i}
                  size="sm"
                  onClick={() => handleBulkEdit(operation)}
                  disabled={isUpdating || selectedMonitors.length === 0}
                  title={
                    selectedMonitors.length === 0 &&
                    tct('Please select monitors to [actionText]', {actionText})
                  }
                  aria-label={actionText}
                  {...analyticsProps}
                >
                  {selectedMonitors.length > 0
                    ? `${actionText} ${tn(
                        '%s monitor',
                        '%s monitors',
                        selectedMonitors.length
                      )}`
                    : actionText}
                </Button>
              )
            )}
          </ActionButtons>
          <ButtonBar>
            <SearchBar
              size="sm"
              placeholder={t('Search Monitors')}
              query={searchQuery}
              onSearch={handleSearch}
            />
            <SortSelector
              size="sm"
              onChangeOrder={({value: order}) =>
                setSortSelection({...sortSelection, order})
              }
              onChangeSort={({value: sort}) => setSortSelection({...sortSelection, sort})}
              {...sortSelection}
            />
          </ButtonBar>
        </Actions>
        <StyledPanelTable
          headers={headers}
          stickyHeaders
          isEmpty={monitorList?.length === 0}
          emptyMessage={t('No monitors found')}
        >
          {isPending || !monitorList
            ? [...new Array(NUM_PLACEHOLDER_ROWS)].map((_, i) => (
                <RowPlaceholder key={i}>
                  <Placeholder height="20px" />
                </RowPlaceholder>
              ))
            : monitorList.map(monitor => (
                <Fragment key={monitor.slug}>
                  <MonitorSlug>
                    <Checkbox
                      checked={isMonitorSelected(monitor)}
                      onChange={() => {
                        handleToggleMonitor(monitor);
                      }}
                    />
                    <Text>{monitor.slug}</Text>
                  </MonitorSlug>
                  <div>
                    <Text>
                      {monitor.status === 'active' ? t('Active') : t('Disabled')}
                    </Text>
                  </div>
                  <div>
                    <Text>{monitor.isMuted ? t('Yes') : t('No')}</Text>
                  </div>
                  <div>
                    <Text>{scheduleAsText(monitor.config)}</Text>
                  </div>
                </Fragment>
              ))}
        </StyledPanelTable>
        <Pagination pageLinks={monitorPageLinks ?? ''} onCursor={setCursor} />
      </Body>
      <Footer>
        <Button priority="primary" onClick={closeModal} aria-label={t('Done')}>
          {t('Done')}
        </Button>
      </Footer>
    </Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 900px;
`;

const Actions = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const ActionButtons = styled(ButtonBar)`
  margin-right: auto;
`;

const StyledPanelTable = styled(PanelTable)`
  overflow-y: scroll;
  max-height: 390px; /* Cut one row off to make it clear there's more content */
`;

const RowPlaceholder = styled('div')`
  grid-column: 1 / -1;
  padding: ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const MonitorSlug = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
`;
