import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {BulkEditOperation} from 'sentry/actionCreators/monitors';
import {bulkEditMonitors} from 'sentry/actionCreators/monitors';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Checkbox from 'sentry/components/checkbox';
import Pagination from 'sentry/components/pagination';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import SearchBar from 'sentry/components/searchBar';
import Text from 'sentry/components/text';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {Monitor} from 'sentry/views/monitors/types';
import {makeMonitorListQueryKey, scheduleAsText} from 'sentry/views/monitors/utils';

interface Props extends ModalRenderProps {}

const NUM_PLACEHOLDER_ROWS = 5;

export function BulkEditMonitorsModal({Header, Body, Footer, closeModal}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const queryClient = useQueryClient();
  const api = useApi();

  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>();
  const queryKey = makeMonitorListQueryKey(organization, {
    ...location.query,
    query: searchQuery,
    cursor,
  });

  const [selectedMonitors, setSelectedMonitors] = useState<Monitor[]>([]);
  const isMonitorSelected = (monitor: Monitor): boolean => {
    return !!selectedMonitors.find(m => m.slug === monitor.slug);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCursor(undefined);
  };

  const handleToggleMonitor = (monitor: Monitor) => {
    const checked = isMonitorSelected(monitor);
    if (!checked) {
      setSelectedMonitors([...selectedMonitors, monitor]);
    } else {
      setSelectedMonitors(selectedMonitors.filter(m => m.slug !== monitor.slug));
    }
  };

  const handleBulkEdit = async (operation: BulkEditOperation) => {
    setIsUpdating(true);
    const resp = await bulkEditMonitors(
      api,
      organization.slug,
      selectedMonitors.map(monitor => monitor.slug),
      operation
    );
    setSelectedMonitors([]);

    if (resp?.updated) {
      setApiQueryData(queryClient, queryKey, (oldMonitorList: Monitor[]) => {
        return oldMonitorList.map(
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
    isLoading,
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
  };
  const muteUnmuteBtnParams = {
    operation: {isMuted: shouldMute ? true : false},
    actionText: shouldMute ? t('Mute') : t('Unmute'),
  };

  return (
    <Fragment>
      <Header closeButton>
        <h3>{t('Manage Monitors')}</h3>
      </Header>
      <Body>
        <Actions>
          <ActionButtons gap={1}>
            {[disableEnableBtnParams, muteUnmuteBtnParams].map(
              ({operation, actionText}, i) => (
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
          <SearchBar
            size="sm"
            placeholder={t('Search Monitors')}
            query={searchQuery}
            onSearch={handleSearch}
          />
        </Actions>
        <StyledPanelTable headers={headers} stickyHeaders>
          {isLoading || !monitorList
            ? [...new Array(NUM_PLACEHOLDER_ROWS)].map((_, i) => (
                <RowPlaceholder key={i}>
                  <Placeholder height="2rem" />
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
                  <Text>{monitor.status === 'active' ? t('Active') : t('Disabled')}</Text>
                  <Text>{monitor.isMuted ? t('Yes') : t('No')}</Text>
                  <Text>{scheduleAsText(monitor.config)}</Text>
                </Fragment>
              ))}
        </StyledPanelTable>
        {monitorPageLinks && (
          <Pagination pageLinks={monitorListHeaders?.('Link')} onCursor={setCursor} />
        )}
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
  max-width: 800px;
`;

const Actions = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  margin-bottom: ${space(2)};
`;

const ActionButtons = styled(ButtonBar)`
  margin-right: auto;
`;

const StyledPanelTable = styled(PanelTable)`
  overflow: scroll;
  max-height: 425px;
`;

const RowPlaceholder = styled('div')`
  grid-column: 1 / -1;
  padding: ${space(1)};
`;

const MonitorSlug = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
`;

export default BulkEditMonitorsModal;
