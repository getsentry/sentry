import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'app/actionCreators/modal';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'app/components/panels';
import {IconFlag} from 'app/icons';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const BYE_URL = '/';
const leaveRedirect = () => (window.location.href = BYE_URL);

const Important = styled('div')`
  font-weight: bold;
  font-size: 1.2em;
`;

const GoodbyeModalContent = ({Header, Body, Footer}: ModalRenderProps) => (
  <div>
    <Header>{t('Closing Account')}</Header>
    <Body>
      <TextBlock>
        {t('Your account has been deactivated and scheduled for removal.')}
      </TextBlock>
      <TextBlock>
        {t('Thanks for using Sentry! We hope to see you again soon!')}
      </TextBlock>
    </Body>
    <Footer>
      <Button href={BYE_URL}>{t('Goodbye')}</Button>
    </Footer>
  </div>
);

type OwnedOrg = {
  organization: Organization;
  singleOwner: boolean;
};

type Props = AsyncView['props'];

type State = AsyncView['state'] & {
  organizations: OwnedOrg[] | null;
  /**
   * Org slugs that will be removed
   */
  orgsToRemove: Set<string> | null;
};

class AccountClose extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['organizations', '/organizations/?owner=1']];
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      orgsToRemove: null,
    };
  }

  get singleOwnerOrgs() {
    return this.state.organizations
      ?.filter(({singleOwner}) => singleOwner)
      ?.map(({organization}) => organization.slug);
  }

  handleChange = (
    {slug}: Organization,
    isSingle: boolean,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const checked = event.target.checked;

    // Can't unselect an org where you are the single owner
    if (isSingle) {
      return;
    }

    this.setState(state => {
      const set = state.orgsToRemove || new Set(this.singleOwnerOrgs);
      if (checked) {
        set.add(slug);
      } else {
        set.delete(slug);
      }

      return {orgsToRemove: set};
    });
  };

  handleRemoveAccount = async () => {
    const {orgsToRemove} = this.state;
    const orgs = orgsToRemove === null ? this.singleOwnerOrgs : Array.from(orgsToRemove);

    addLoadingMessage('Closing account\u2026');

    try {
      await this.api.requestPromise('/users/me/', {
        method: 'DELETE',
        data: {organizations: orgs},
      });

      openModal(GoodbyeModalContent, {
        onClose: leaveRedirect,
      });

      // Redirect after 10 seconds
      setTimeout(leaveRedirect, 10000);
    } catch {
      addErrorMessage('Error closing account');
    }
  };

  renderBody() {
    const {organizations, orgsToRemove} = this.state;

    return (
      <div>
        <SettingsPageHeader title="Close Account" />

        <TextBlock>
          {t('This will permanently remove all associated data for your user')}.
        </TextBlock>

        <Alert type="error" icon={<IconFlag size="md" />}>
          <Important>
            {t('Closing your account is permanent and cannot be undone')}!
          </Important>
        </Alert>

        <Panel>
          <PanelHeader>{t('Remove the following organizations')}</PanelHeader>
          <PanelBody>
            <PanelAlert type="info">
              {t(
                'Ownership will remain with other organization owners if an organization is not deleted.'
              )}
              <br />
              {tct(
                "Boxes which can't be unchecked mean that you are the only organization owner and the organization [strong:will be deleted].",
                {strong: <strong />}
              )}
            </PanelAlert>

            {organizations?.map(({organization, singleOwner}) => (
              <PanelItem key={organization.slug}>
                <label>
                  <input
                    style={{marginRight: 6}}
                    type="checkbox"
                    value={organization.slug}
                    onChange={this.handleChange.bind(this, organization, singleOwner)}
                    name="organizations"
                    checked={
                      orgsToRemove === null
                        ? singleOwner
                        : orgsToRemove.has(organization.slug)
                    }
                    disabled={singleOwner}
                  />
                  {organization.slug}
                </label>
              </PanelItem>
            ))}
          </PanelBody>
        </Panel>

        <Confirm
          priority="danger"
          message={t(
            'This is permanent and cannot be undone, are you really sure you want to do this?'
          )}
          onConfirm={this.handleRemoveAccount}
        >
          <Button priority="danger">{t('Close Account')}</Button>
        </Confirm>
      </div>
    );
  }
}

export default AccountClose;
