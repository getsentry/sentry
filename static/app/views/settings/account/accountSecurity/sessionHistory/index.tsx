import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {InternetProtocol} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import SessionRow from './sessionRow';
import {tableLayout} from './utils';

type Props = RouteComponentProps<{}, {}>;

type State = {
  ipList: Array<InternetProtocol> | null;
} & DeprecatedAsyncView['state'];

class SessionHistory extends DeprecatedAsyncView<Props, State> {
  getTitle() {
    return t('Session History');
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['ipList', '/users/me/ips/']];
  }

  renderBody() {
    const {ipList} = this.state;

    if (!ipList) {
      return null;
    }

    const {routes, params, location} = this.props;
    const recreateRouteProps = {routes, params, location};

    return (
      <Fragment>
        <SettingsPageHeader
          title={t('Security')}
          tabs={
            <NavTabs underlined>
              <ListLink
                to={recreateRoute('', {...recreateRouteProps, stepBack: -1})}
                index
              >
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
      </Fragment>
    );
  }
}

export default SessionHistory;

const SessionPanelHeader = styled(PanelHeader)`
  ${tableLayout}
  justify-content: initial;
`;
