import {Flex, Box} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import ListLink from 'app/components/listLink';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import TimeSince from 'app/components/timeSince';
import recreateRoute from 'app/utils/recreateRoute';

class SessionRow extends React.Component {
  static propTypes = {
    ipAddress: PropTypes.string.isRequired,
    countryCode: PropTypes.string,
    regionCode: PropTypes.string,
    lastSeen: PropTypes.string.isRequired,
    firstSeen: PropTypes.string.isRequired,
  };

  render() {
    let {ipAddress, countryCode, regionCode, lastSeen, firstSeen} = this.props;

    return (
      <PanelItem justify="space-between">
        <Flex align="center" flex={1}>
          <Box flex="1">
            <div style={{marginBottom: 5}}>
              <strong>{ipAddress}</strong>
            </div>
            {countryCode &&
              regionCode && (
                <div>
                  <small>
                    {countryCode} ({regionCode})
                  </small>
                </div>
              )}
          </Box>
        </Flex>
        <Flex align="center" w={140} mx={2}>
          <small>
            <TimeSince date={firstSeen} />
          </small>
        </Flex>
        <Flex align="center" w={140} mx={2}>
          <small>
            <TimeSince date={lastSeen} />
          </small>
        </Flex>
      </PanelItem>
    );
  }
}

class AccountSecuritySessionHistory extends AsyncView {
  getTitle() {
    return t('Session History');
  }

  getEndpoints() {
    return [['ipList', '/users/me/ips/']];
  }

  renderBody() {
    let {ipList} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title="Security"
          tabs={
            <ul className="nav nav-tabs" style={{borderBottom: '1px solid #ddd'}}>
              <ListLink
                to={recreateRoute('', {...this.props, stepBack: -1})}
                index={true}
              >
                {t('Settings')}
              </ListLink>
              <ListLink to={recreateRoute('', this.props)}>
                {t('Session History')}
              </ListLink>
            </ul>
          }
        />

        <Panel>
          <PanelHeader>
            <Flex align="center" flex={1}>
              {t('Sessions')}
            </Flex>
            <Flex w={140} mx={2}>
              {t('First Seen')}
            </Flex>
            <Flex w={140} mx={2}>
              {t('Last Seen')}
            </Flex>
          </PanelHeader>
          <PanelBody>
            {ipList.map(ipObj => {
              return <SessionRow key={ipObj.id} {...ipObj} />;
            })}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

export default withRouter(AccountSecuritySessionHistory);
