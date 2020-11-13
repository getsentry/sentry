import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TimeSince from 'app/components/timeSince';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';

type SessionRowProps = {
  ipAddress: string;
  lastSeen: string;
  firstSeen: string;
  countryCode?: string;
  regionCode?: string;
};

function SessionRow({
  ipAddress,
  lastSeen,
  firstSeen,
  countryCode,
  regionCode,
}: SessionRowProps) {
  return (
    <SessionPanelItem>
      <IpAndLocation>
        <div>
          <IpAddress>{ipAddress}</IpAddress>
          {countryCode && regionCode && (
            <CountryCode>{`${countryCode} (${regionCode})`}</CountryCode>
          )}
        </div>
      </IpAndLocation>
      <StyledTimeSince date={firstSeen} />
      <StyledTimeSince date={lastSeen} />
    </SessionPanelItem>
  );
}

type Props = RouteComponentProps<{}, {}>;

type State = {
  ipList: Array<any> | null;
} & AsyncView['state'];

class AccountSecuritySessionHistory extends AsyncView<Props, State> {
  getTitle() {
    return t('Session History');
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
      <React.Fragment>
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
            {ipList.map(ipObj => (
              <SessionRow key={ipObj.id} {...ipObj} />
            ))}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

export default AccountSecuritySessionHistory;

const IpAddress = styled('div')`
  margin-bottom: ${space(0.5)};
  font-weight: bold;
`;
const CountryCode = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const IpAndLocation = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const getTableLayout = `
  display: grid;
  grid-template-columns: auto 140px 140px;
  grid-gap ${space(1)};
  align-items: center;
`;

const SessionPanelHeader = styled(PanelHeader)`
  ${getTableLayout}
  justify-content: initial;
`;

const SessionPanelItem = styled(PanelItem)`
  ${getTableLayout}
`;
