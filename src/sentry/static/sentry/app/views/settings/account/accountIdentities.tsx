import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {disconnectIdentity} from 'app/actionCreators/account';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import {Identity} from 'app/types';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const ENDPOINT = '/users/me/social-identities/';

type Props = RouteComponentProps<{}, {}>;

type State = {
  identities: Identity[];
} & AsyncView['state'];

class AccountIdentities extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      identities: [],
    };
  }

  getEndpoints(): [string, string][] {
    return [['identities', ENDPOINT]];
  }

  getTitle() {
    return 'Identities';
  }

  handleDisconnect = identity => {
    const {identities} = this.state;

    this.setState(
      state => {
        const newIdentities = state.identities.filter(({id}) => id !== identity.id);

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
    const isEmpty = this.state.identities.length === 0;

    return (
      <div>
        <SettingsPageHeader title="Identities" />
        <Panel>
          <PanelHeader>{t('Identities')}</PanelHeader>
          <PanelBody>
            {isEmpty && (
              <EmptyMessage>
                {t('There are no identities associated with this account')}
              </EmptyMessage>
            )}

            {!isEmpty &&
              this.state.identities.map(identity => (
                <IdentityPanelItem key={identity.id}>
                  <div>{identity.providerLabel}</div>

                  <Button
                    size="small"
                    onClick={this.handleDisconnect.bind(this, identity)}
                  >
                    {t('Disconnect')}
                  </Button>
                </IdentityPanelItem>
              ))}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

const IdentityPanelItem = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
`;

export default AccountIdentities;
