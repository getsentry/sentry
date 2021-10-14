import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {disconnectIdentity} from 'app/actionCreators/account';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import {UserIdentityCategory, UserIdentityConfig, UserIdentityStatus} from 'app/types';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const ENDPOINT = '/users/me/user-identities/';

type Props = RouteComponentProps<{}, {}>;

type State = {
  identities: UserIdentityConfig[] | null;
} & AsyncView['state'];

class AccountIdentities extends AsyncView<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      identities: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['identities', ENDPOINT]];
  }

  getTitle() {
    return t('Identities');
  }

  renderItem = (identity: UserIdentityConfig) => {
    return (
      <IdentityPanelItem key={`${identity.category}:${identity.id}`}>
        <div>
          {identity.category === UserIdentityCategory.SOCIAL_IDENTITY ? (
            <span title={t('This identity links to an application.')}>&#x1F517;</span>
          ) : (
            <span title={t('This identity can be used to sign in.')}>&#x1F512;</span>
          )}
          &nbsp;
          {identity.providerName}
          {identity.organization && ` (${identity.organization.name})`}
        </div>

        {this.renderButton(identity)}
      </IdentityPanelItem>
    );
  };

  renderButton(identity: UserIdentityConfig) {
    return (
      <Button
        disabled={identity.status !== UserIdentityStatus.CAN_DISCONNECT}
        title={
          identity.status === UserIdentityStatus.NEEDED_FOR_GLOBAL_AUTH
            ? t(
                'You need this identity to sign into your account. If you want to disconnect it, set a password first.'
              )
            : identity.status === UserIdentityStatus.NEEDED_FOR_ORG_AUTH
            ? t('You need this identity to access your organization.')
            : null
        }
        onClick={() => this.handleDisconnect(identity)}
      >
        {t('Disconnect')}
      </Button>
    );
  }

  handleDisconnect = (identity: UserIdentityConfig) => {
    disconnectIdentity(identity, this.reloadData);
  };

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title="Identities" />
        <Panel>
          <PanelHeader>{t('Identities')}</PanelHeader>
          <PanelBody>
            {!this.state.identities?.length ? (
              <EmptyMessage>
                {t('There are no identities associated with this account')}
              </EmptyMessage>
            ) : (
              this.state.identities.map(this.renderItem)
            )}
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
