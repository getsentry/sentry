/**
 * Lists 2fa devices + password change form
 */
import {Box, Flex} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import CircleIndicator from 'app/components/circleIndicator';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Field from 'app/views/settings/components/forms/field';
import ListLink from 'app/components/listLink';
import NavTabs from 'app/components/navTabs';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Tooltip from 'app/components/tooltip';
import TwoFactorRequired from 'app/views/settings/account/accountSecurity/components/twoFactorRequired';
import RemoveConfirm from 'app/views/settings/account/accountSecurity/components/removeConfirm';
import PasswordForm from 'app/views/settings/account/passwordForm';
import recreateRoute from 'app/utils/recreateRoute';

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
            <NavTabs underlined={true}>
              <ListLink to={recreateRoute('', this.props)} index={true}>
                {t('Settings')}
              </ListLink>
              <ListLink to={recreateRoute('session-history/', this.props)}>
                {t('Session History')}
              </ListLink>
            </NavTabs>
          }
        />

        {!isEmpty && countEnrolled == 0 && <TwoFactorRequired />}

        <PasswordForm />

        <Panel>
          <PanelHeader>{t('Sessions')}</PanelHeader>
          <PanelBody>
            <Field
              alignRight={true}
              flexibleControlStateSize={true}
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
          <PanelHeader>
            <Box>{t('Two-Factor Authentication')}</Box>
          </PanelHeader>

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
                  <PanelItem key={id} p={0} direction="column">
                    <Flex flex="1" p={2} align="center">
                      <Box flex="1">
                        <CircleIndicator css={{marginRight: 6}} enabled={isEnrolled} />
                        <AuthenticatorName>{name}</AuthenticatorName>
                      </Box>

                      {!isBackupInterface &&
                        !isEnrolled && (
                          <Button
                            to={`/settings/account/security/mfa/${id}/enroll/`}
                            size="small"
                            priority="primary"
                            className="enroll-button"
                          >
                            {t('Add')}
                          </Button>
                        )}

                      {isEnrolled &&
                        authId && (
                          <Button
                            to={`/settings/account/security/mfa/${authId}/`}
                            size="small"
                            className="details-button"
                          >
                            {configureButton}
                          </Button>
                        )}

                      {!isBackupInterface &&
                        isEnrolled && (
                          <Tooltip
                            title={t(
                              `Two-factor authentication is required for organization(s): ${this.formatOrgSlugs()}.`
                            )}
                            disabled={!deleteDisabled}
                          >
                            <span>
                              <RemoveConfirm
                                onConfirm={() => onDisable(auth)}
                                disabled={deleteDisabled}
                              >
                                <Button css={{marginLeft: 6}} size="small">
                                  <span className="icon icon-trash" />
                                </Button>
                              </RemoveConfirm>
                            </span>
                          </Tooltip>
                        )}

                      {isBackupInterface && !isEnrolled ? t('requires 2FA') : null}
                    </Flex>

                    <Box p={2} pt={0}>
                      <TextBlock css={{marginBottom: 0}}>{description}</TextBlock>
                    </Box>
                  </PanelItem>
                );
              })}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

const AuthenticatorName = styled.span`
  font-size: 1.2em;
`;

export default AccountSecurity;
