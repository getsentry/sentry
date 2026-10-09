import styled from '@emotion/styled';

import type {TableColumnConfig} from '@sentry/scraps/table';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {InternetProtocol} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SessionRow} from './sessionRow';

type IpListType = InternetProtocol[] | null;

const COLUMNS: TableColumnConfig[] = [
  {key: 'session', width: 'minmax(150px, 1fr)'},
  {key: 'firstSeen', width: 160},
  {key: 'lastSeen', width: 160},
];

export default function SessionHistory() {
  const location = useLocation();
  const {
    data: ipList = [],
    isLoading,
    isError,
    refetch,
  } = useApiQuery<IpListType>(
    [getApiUrl('/users/$userId/ips/', {path: {userId: 'me'}})],
    {
      staleTime: 0,
      enabled: !isDemoModeActive(),
    }
  );

  const maybeTab = location.pathname.split('/').at(-2);
  const activeTab =
    maybeTab === 'settings'
      ? 'settings'
      : maybeTab === 'session-history'
        ? 'sessionHistory'
        : 'settings';

  const routePrefix = '/settings/account/security/';
  return (
    <SentryDocumentTitle title={t('Session History')}>
      <SettingsPageHeader title={t('Security')} />
      <TabsContainer>
        <Tabs value={activeTab}>
          <TabList>
            <TabList.Item key="settings" to={routePrefix}>
              {t('Settings')}
            </TabList.Item>
            <TabList.Item key="sessionHistory" to={`${routePrefix}session-history/`}>
              {t('Session History')}
            </TabList.Item>
          </TabList>
        </Tabs>
      </TabsContainer>

      <SimpleTable
        aria-label={t('Session History')}
        columns={COLUMNS}
        flexibleLastColumn={false}
        scrollable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Sessions')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('First Seen')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Last Seen')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isError ? (
          <SimpleTable.Error onRetry={refetch} />
        ) : isLoading ? (
          <SimpleTable.Loading />
        ) : ipList?.length ? (
          ipList.map(({id, ...ipObj}) => <SessionRow key={id} {...ipObj} />)
        ) : (
          <SimpleTable.Empty>{t('No sessions found')}</SimpleTable.Empty>
        )}
      </SimpleTable>
    </SentryDocumentTitle>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;
