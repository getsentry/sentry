import {Box} from 'grid-emotion';
import React from 'react';

import {disconnectIdentity} from '../../../actionCreators/account';
import {t} from '../../../locale';
import AsyncView from '../../asyncView';
import Button from '../../../components/buttons/button';
import EmptyMessage from '../components/emptyMessage';
import Panel from '../components/panel';
import PanelBody from '../components/panelBody';
import PanelHeader from '../components/panelHeader';
import PanelItem from '../components/panelItem';
import SettingsPageHeader from '../components/settingsPageHeader';

const ENDPOINT = '/users/me/social-identities/';

class AccountIdentities extends AsyncView {
  getEndpoints() {
    return [['identities', ENDPOINT]];
  }

  getTitle() {
    return 'Identities';
  }

  getDefaultState() {
    return {
      identities: [],
    };
  }

  handleDisconnect = (identity, e) => {
    let {identities} = this.state;

    this.setState(
      state => {
        let newIdentities = state.identities.filter(({id}) => id !== identity.id);

        return {
          identities: newIdentities,
        };
      },
      () =>
        disconnectIdentity(identity).catch(() => {
          this.setState({
            identities,
          });
        })
    );
  };

  renderBody() {
    let isEmpty = this.state.identities.length === 0;

    return (
      <div>
        <SettingsPageHeader title="Identities" />
        <Panel>
          <PanelHeader disablePadding>
            <Box px={2}>{t('Identities')}</Box>
          </PanelHeader>
          <PanelBody>
            {isEmpty && (
              <EmptyMessage>
                {t('There are no identities associated with this account')}
              </EmptyMessage>
            )}

            {!isEmpty &&
              this.state.identities.map(identity => (
                <PanelItem p={0} key={identity.id} align="center">
                  <Box flex="1" p={2}>
                    {identity.providerLabel}
                  </Box>

                  <Box p={2}>
                    <Button
                      size="small"
                      onClick={this.handleDisconnect.bind(this, identity)}
                    >
                      {t('Disconnect')}
                    </Button>
                  </Box>
                </PanelItem>
              ))}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default AccountIdentities;
