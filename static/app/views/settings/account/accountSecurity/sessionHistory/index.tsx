import styled from '@emotion/styled';

import ListLink from 'sentry/components/links/listLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NavTabs from 'sentry/components/navTabs';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {InternetProtocol} from 'sentry/types/user';
import {useApiQuery} from 'sentry/utils/queryClient';
import recreateRoute from 'sentry/utils/recreateRoute';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SessionRow from './sessionRow';
import {tableLayout} from './utils';

type Props = RouteComponentProps;

type IpListType = InternetProtocol[] | null;

function SessionHistory({routes, params, location}: Props) {
  const {
    data: ipList,
    isPending,
    isError,
  } = useApiQuery<IpListType>(['/users/me/ips/'], {staleTime: 0});

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (!ipList) {
    return null;
  }

  const recreateRouteProps = {routes, params, location};

  return (
    <SentryDocumentTitle title={t('Session History')}>
      <SettingsPageHeader
        title={t('Security')}
        tabs={
          <NavTabs underlined>
            <ListLink to={recreateRoute('', {...recreateRouteProps, stepBack: -1})} index>
              {t('Settings')}
            </ListLink>
            <ListLink to={recreateRoute('', recreateRouteProps)}>
              {t('Session History')}
            </ListLink>
          </NavTabs>
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

export default SessionHistory;

const SessionPanelHeader = styled(PanelHeader)`
  ${tableLayout}
  justify-content: initial;
`;
