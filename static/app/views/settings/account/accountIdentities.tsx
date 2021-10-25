import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {disconnectIdentity} from 'app/actionCreators/account';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import PluginIcon from 'app/plugins/components/pluginIcon';
import {UserIdentityCategory, UserIdentityConfig, UserIdentityStatus} from 'app/types';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

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
        <PluginIcon pluginId={identity.provider.key} />
        <div>
          {identity.category === UserIdentityCategory.SOCIAL_IDENTITY ? (
            <span title={t('This identity links to an application.')}>&#x1F517;</span>
          ) : (
            <span title={t('This identity can be used to sign in.')}>&#x1F512;</span>
          )}
        </div>
        <div>
          {identity.provider.name}
          {identity.organization && ` (${identity.organization.name})`}
        </div>

        {this.renderButton(identity)}
      </IdentityPanelItem>
    );
  };

  renderButton(identity: UserIdentityConfig) {
    return identity.status === UserIdentityStatus.CAN_DISCONNECT ? (
      <Confirm
        onConfirm={() => this.handleDisconnect(identity)}
        priority="danger"
        confirmText={t('Disconnect')}
        message={
          <div>
            <TextBlock>Disconnect your {identity.provider.name} identity?</TextBlock>
            {identity.category !== UserIdentityCategory.SOCIAL_IDENTITY && (
              <TextBlock>
                After disconnecting, you will need to use a password or another identity
                to sign in.
              </TextBlock>
            )}
          </div>
        }
      >
        <Button>{t('Disconnect')}</Button>
      </Confirm>
    ) : (
      <Button
        disabled
        title={
          identity.status === UserIdentityStatus.NEEDED_FOR_GLOBAL_AUTH
            ? t(
                'You need this identity to sign into your account. If you want to disconnect it, set a password first.'
              )
            : identity.status === UserIdentityStatus.NEEDED_FOR_ORG_AUTH
            ? t('You need this identity to access your organization.')
            : null
        }
      >
        {t('Disconnect')}
      </Button>
    );
  }

  handleDisconnect = (identity: UserIdentityConfig) => {
    disconnectIdentity(identity, this.reloadData);
  };

  renderBody() {
    const appIdentities = this.state.identities?.filter(
      identity => identity.category !== UserIdentityCategory.ORG_IDENTITY
    );
    const orgIdentities = this.state.identities?.filter(
      identity => identity.category === UserIdentityCategory.ORG_IDENTITY
    );

    return (
      <div>
        <SettingsPageHeader title="Identities" />

        <Panel>
          <PanelHeader>{t('Application Identities')}</PanelHeader>
          <PanelBody>
            {!appIdentities?.length ? (
              <EmptyMessage>
                {t('There are no application identities associated with this account')}
              </EmptyMessage>
            ) : (
              appIdentities.map(this.renderItem)
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Organization Identities')}</PanelHeader>
          <PanelBody>
            {!orgIdentities?.length ? (
              <EmptyMessage>
                {t('There are no organization identities associated with this account')}
              </EmptyMessage>
            ) : (
              orgIdentities.map(this.renderItem)
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
