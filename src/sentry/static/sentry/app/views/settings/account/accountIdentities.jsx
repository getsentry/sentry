import {Box} from 'grid-emotion';
import React from 'react';

import {disconnectIdentity} from 'app/actionCreators/account';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

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
