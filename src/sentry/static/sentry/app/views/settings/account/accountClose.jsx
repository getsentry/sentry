import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'app/components/panels';
import {addMessage, addErrorMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const BYE_URL = '/';
const leaveRedirect = () => (window.location.href = BYE_URL);

const Important = styled.div`
  font-weight: bold;
  font-size: 1.2em;
`;

const GoodbyeModalContent = ({Header, Body, Footer}) => (
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

GoodbyeModalContent.propTypes = {
  Header: PropTypes.node,
  Body: PropTypes.node,
  Footer: PropTypes.node,
};

class AccountClose extends AsyncView {
  getEndpoints() {
    return [['organizations', '/organizations/?owner=1']];
  }

  constructor(...args) {
    super(...args);
    this.state.orgsToRemove = null;
  }

  // Returns an array of single owners
  getSingleOwners = () => {
    return this.state.organizations
      .filter(({singleOwner}) => singleOwner)
      .map(({organization}) => organization.slug);
  };

  handleChange = ({slug}, isSingle, event) => {
    let checked = event.target.checked;

    // Can't unselect an org where you are the single owner
    if (isSingle) return;

    this.setState(state => {
      let set = state.orgsToRemove || new Set(this.getSingleOwners());
      if (checked) {
        set.add(slug);
      } else {
        set.delete(slug);
      }

      return {
        orgsToRemove: set,
      };
    });
  };

  handleRemoveAccount = () => {
    let {orgsToRemove} = this.state;
    let orgs = orgsToRemove === null ? this.getSingleOwners() : Array.from(orgsToRemove);

    addMessage('Closing account...');

    this.api
      .requestPromise('/users/me/', {
        method: 'DELETE',
        data: {organizations: orgs},
      })
      .then(
        () => {
          openModal(GoodbyeModalContent, {
            onClose: leaveRedirect,
          });

          // Redirect after 10 seconds
          setTimeout(leaveRedirect, 10000);
        },
        () => {
          addErrorMessage('Error closing account');
        }
      );
  };

  renderBody() {
    let {organizations, orgsToRemove} = this.state;

    return (
      <div>
        <SettingsPageHeader title="Close Account" />

        <TextBlock>
          {t('This will permanently remove all associated data for your user')}.
        </TextBlock>

        <Alert type="error" icon="icon-circle-exclamation">
          <Important>
            {t('Closing your account is permanent and cannot be undone')}!
          </Important>
        </Alert>

        <Panel>
          <PanelHeader>{t('Remove the following organizations')}</PanelHeader>
          <PanelBody>
            <PanelAlert type="info">
              {t(
                'Ownership will remain with other members if an organization is not deleted.'
              )}
              <br />
              {t(
                'Disabled boxes mean that there is no other owner within the organization so no one else can take ownership.'
              )}
            </PanelAlert>

            {organizations.map(({organization, singleOwner}) => {
              return (
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
              );
            })}
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
