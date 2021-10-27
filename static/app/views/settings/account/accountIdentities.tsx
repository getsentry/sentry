import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {disconnectIdentity} from 'app/actionCreators/account';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
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
        <InternalContainer>
          <IdentityName>{identity.provider.name}</IdentityName>
          {identity.dateAdded && <IdentityDate>{identity.dateAdded}</IdentityDate>}
        </InternalContainer>
        <InternalContainer>
          <Tag
            isOrgName={false}
            label={
              identity.category === UserIdentityCategory.SOCIAL_IDENTITY
                ? t('App Integration')
                : identity.category === UserIdentityCategory.GLOBAL_IDENTITY
                ? t('Sign-In Identity')
                : identity.category === UserIdentityCategory.ORG_IDENTITY
                ? t('Organization Identity')
                : ''
            }
          />
          {identity.organization && <Tag isOrgName label={identity.organization.slug} />}
        </InternalContainer>

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
        header={`Disconnect Your ${identity.provider.name} Identity?`}
        message={
          <TextBlock>
            {identity.category === UserIdentityCategory.SOCIAL_IDENTITY
              ? t("This action can't be undone.")
              : t(
                  'After disconnecting, you will need to use a password or another identity to sign in.'
                )}
          </TextBlock>
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

  itemOrder = (a: UserIdentityConfig, b: UserIdentityConfig) => {
    function categoryRank(c: UserIdentityConfig) {
      return [
        UserIdentityCategory.GLOBAL_IDENTITY,
        UserIdentityCategory.SOCIAL_IDENTITY,
        UserIdentityCategory.ORG_IDENTITY,
      ].indexOf(c.category);
    }

    if (a.provider.name !== b.provider.name) {
      return a.provider.name < b.provider.name ? -1 : 1;
    } else if (a.category !== b.category) {
      return categoryRank(a) - categoryRank(b);
    } else if ((a.organization?.name ?? '') !== (b.organization?.name ?? '')) {
      return (a.organization?.name ?? '') < (b.organization?.name ?? '') ? -1 : 1;
    } else return 0;
  };

  renderBody() {
    const appIdentities = this.state.identities
      ?.filter(identity => identity.category !== UserIdentityCategory.ORG_IDENTITY)
      .sort(this.itemOrder);
    const orgIdentities = this.state.identities
      ?.filter(identity => identity.category === UserIdentityCategory.ORG_IDENTITY)
      .sort(this.itemOrder);

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

const InternalContainer = styled('div')`
  display: flex;
  padding: 0 ${space(2)};
`;

const IdentityName = styled('div')`
  font-weight: bold;
`;

const IdentityDate = styled('div')`
  display: flex;
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

const Tag = styled(
  ({
    isOrgName: _isOrgName,
    label,
    ...p
  }: {
    label: string;
    isOrgName: boolean;
    theme?: any;
  }) => <div {...p}>{label}</div>
)`
  display: flex;
  flex-direction: row;
  padding: 1px 10px;
  background: ${p => (p.isOrgName ? p.theme.purple200 : p.theme.gray100)};
  border-radius: 20px;
  font-size: ${space(1.5)};
  margin-right: ${space(1)};
  line-height: ${space(3)};
  text-align: center;
  color: ${p => (p.isOrgName ? p.theme.white : p.theme.gray500)};
`;

export default AccountIdentities;
