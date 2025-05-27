import styled from '@emotion/styled';

import {TabList, Tabs} from 'sentry/components/core/tabs';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {InternetProtocol} from 'sentry/types/user';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {useApiQuery} from 'sentry/utils/queryClient';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SessionRow from './sessionRow';
import {tableLayout} from './utils';

type IpListType = InternetProtocol[] | null;

function SessionHistory({location}: RouteComponentProps) {
  const {
    data: ipList = [],
    isLoading,
    isError,
  } = useApiQuery<IpListType>(['/users/me/ips/'], {
    staleTime: 0,
    enabled: !isDemoModeActive(),
  });

  if (isError) {
    return <LoadingError />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!ipList) {
    return null;
  }

  const maybeTab = location.pathname.split('/').at(-2);
  const activeTab =
    maybeTab === 'settings'
      ? 'settings'
      : maybeTab === 'session-history'
        ? 'sessionHistory'
        : 'settings';

  const routePrefix = `/settings/account/security/`;
  return (
    <SentryDocumentTitle title={t('Session History')}>
      <SettingsPageHeader
        title={t('Security')}
        tabs={
          <TabsContainer>
            <Tabs value={activeTab}>
              <TabList>
                <TabList.Item key="settings" to={`${routePrefix}`}>
                  {t('Settings')}
                </TabList.Item>
                <TabList.Item key="sessionHistory" to={`${routePrefix}session-history/`}>
                  {t('Session History')}
                </TabList.Item>
              </TabList>
            </Tabs>
          </TabsContainer>
        }
      />

      <Panel>
        <SessionPanelHeader>
          <div>{t('Sessions')}</div>
          <div>{t('First Seen')}</div>
          <div>{t('Last Seen')}</div>
        </SessionPanelHeader>

        <PanelBody>
          {ipList.map(({id, ...ipObj}) => (
            <SessionRow key={id} {...ipObj} />
          ))}
        </PanelBody>
      </Panel>
    </SentryDocumentTitle>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default SessionHistory;

const SessionPanelHeader = styled(PanelHeader)`
  ${tableLayout}
  justify-content: initial;
`;
