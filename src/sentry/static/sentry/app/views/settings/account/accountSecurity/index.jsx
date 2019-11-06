import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Field from 'app/views/settings/components/forms/field';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import PasswordForm from 'app/views/settings/account/passwordForm';
import RemoveConfirm from 'app/views/settings/account/accountSecurity/components/removeConfirm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Tooltip from 'app/components/tooltip';
import TwoFactorRequired from 'app/views/settings/account/accountSecurity/components/twoFactorRequired';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';

/**
 * Lists 2fa devices + password change form
 */
class AccountSecurity extends AsyncView {
  static PropTypes = {
    authenticators: PropTypes.arrayOf(PropTypes.object).isRequired,
    orgsRequire2fa: PropTypes.arrayOf(PropTypes.object).isRequired,
    countEnrolled: PropTypes.number.isRequired,
    deleteDisabled: PropTypes.bool.isRequired,
    onDisable: PropTypes.func.isRequired,
  };

  getTitle() {
    return t('Security');
  }

  getEndpoints() {
    return [];
  }

  handleSessionClose = () => {
    this.api.request('/auth/', {
      method: 'DELETE',
      data: {all: true},
      success: () => {
        window.location = '/auth/login/';
      },
    });
  };

  formatOrgSlugs = () => {
    const {orgsRequire2fa} = this.props;
    const slugs = orgsRequire2fa.map(({slug}) => slug);

    return [slugs.slice(0, -1).join(', '), slugs.slice(-1)[0]].join(
      slugs.length > 1 ? ' and ' : ''
    );
  };

  renderBody() {
    const {authenticators, countEnrolled, deleteDisabled, onDisable} = this.props;
    const isEmpty = !authenticators.length;

    return (
      <div>
        <SettingsPageHeader
          title="Security"
          tabs={
            <NavTabs underlined>
              <ListLink to={recreateRoute('', this.props)} index>
                {t('Settings')}
              </ListLink>
              <ListLink to={recreateRoute('session-history/', this.props)}>
                {t('Session History')}
              </ListLink>
            </NavTabs>
          }
        />

        {!isEmpty && countEnrolled === 0 && <TwoFactorRequired />}

        <PasswordForm />

        <Panel>
          <PanelHeader>{t('Sessions')}</PanelHeader>
          <PanelBody>
            <Field
              alignRight
              flexibleControlStateSize
              label={t('Sign out of all devices')}
              help={t(
                'Signing out of all devices will sign you out of this device as well.'
              )}
            >
              <Button data-test-id="signoutAll" onClick={this.handleSessionClose}>
                {t('Sign out of all devices')}
              </Button>
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>{t('Two-Factor Authentication')}</PanelHeader>

          {isEmpty && (
            <EmptyMessage>{t('No available authenticators to add')}</EmptyMessage>
          )}

          <PanelBody>
            {!isEmpty &&
              authenticators.map(auth => {
                const {
                  id,
                  authId,
                  description,
                  isBackupInterface,
                  isEnrolled,
                  configureButton,
                  name,
                } = auth;
                return (
                  <AuthenticatorPanelItem key={id}>
                    <AuthenticatorHeader>
                      <AuthenticatorTitle>
                        <AuthenticatorStatus enabled={isEnrolled} />
                        <AuthenticatorName>{name}</AuthenticatorName>
                      </AuthenticatorTitle>

                      <Actions>
                        {!isBackupInterface && !isEnrolled && (
                          <Button
                            to={`/settings/account/security/mfa/${id}/enroll/`}
                            size="small"
                            priority="primary"
                            className="enroll-button"
                          >
                            {t('Add')}
                          </Button>
                        )}

                        {isEnrolled && authId && (
                          <Button
                            to={`/settings/account/security/mfa/${authId}/`}
                            size="small"
                            className="details-button"
                          >
                            {configureButton}
                          </Button>
                        )}

                        {!isBackupInterface && isEnrolled && (
                          <Tooltip
                            title={t(
                              `Two-factor authentication is required for organization(s): ${this.formatOrgSlugs()}.`
                            )}
                            disabled={!deleteDisabled}
                          >
                            <RemoveConfirm
                              onConfirm={() => onDisable(auth)}
                              disabled={deleteDisabled}
                            >
                              <Button size="small" icon="icon-trash" />
                            </RemoveConfirm>
                          </Tooltip>
                        )}
                      </Actions>

                      {isBackupInterface && !isEnrolled ? t('requires 2FA') : null}
                    </AuthenticatorHeader>

                    <Description>{description}</Description>
                  </AuthenticatorPanelItem>
                );
              })}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

const AuthenticatorName = styled('span')`
  font-size: 1.2em;
`;

const AuthenticatorPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const AuthenticatorHeader = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
`;

const AuthenticatorTitle = styled('div')`
  flex: 1;
`;

const Actions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;

const AuthenticatorStatus = styled(CircleIndicator)`
  margin-right: ${space(1)};
`;

const Description = styled(TextBlock)`
  margin-top: ${space(2)};
  margin-bottom: 0;
`;

export default AccountSecurity;
