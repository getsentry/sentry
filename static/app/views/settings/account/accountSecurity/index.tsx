import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openEmailVerification} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import CircleIndicator from 'sentry/components/circleIndicator';
import Field from 'sentry/components/forms/field';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Authenticator, OrganizationSummary} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import AsyncView from 'sentry/views/asyncView';
import RemoveConfirm from 'sentry/views/settings/account/accountSecurity/components/removeConfirm';
import TwoFactorRequired from 'sentry/views/settings/account/accountSecurity/components/twoFactorRequired';
import PasswordForm from 'sentry/views/settings/account/passwordForm';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  authenticators: Authenticator[] | null;
  countEnrolled: number;
  deleteDisabled: boolean;
  handleRefresh: () => void;
  hasVerifiedEmail: boolean;
  onDisable: (auth: Authenticator) => void;
  orgsRequire2fa: OrganizationSummary[];
} & AsyncView['props'] &
  RouteComponentProps<{}, {}>;

/**
 * Lists 2fa devices + password change form
 */
class AccountSecurity extends AsyncView<Props> {
  getTitle() {
    return t('Security');
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [];
  }

  handleSessionClose = async () => {
    try {
      await this.api.requestPromise('/auth/', {
        method: 'DELETE',
        data: {all: true},
      });
      window.location.assign('/auth/login/');
    } catch (err) {
      addErrorMessage(t('There was a problem closing all sessions'));
      throw err;
    }
  };

  formatOrgSlugs = () => {
    const {orgsRequire2fa} = this.props;
    const slugs = orgsRequire2fa.map(({slug}) => slug);

    return [slugs.slice(0, -1).join(', '), slugs.slice(-1)[0]].join(
      slugs.length > 1 ? ' and ' : ''
    );
  };

  handleAdd2FAClicked = () => {
    const {handleRefresh} = this.props;
    openEmailVerification({
      onClose: () => {
        handleRefresh();
      },
      actionMessage: 'enrolling a 2FA device',
    });
  };

  renderBody() {
    const {authenticators, countEnrolled, deleteDisabled, onDisable, hasVerifiedEmail} =
      this.props;
    const isEmpty = !authenticators?.length;
    return (
      <div>
        <SettingsPageHeader
          title={t('Security')}
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
              authenticators?.map(auth => {
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
                        {!isBackupInterface && !isEnrolled && hasVerifiedEmail && (
                          <Button
                            to={`/settings/account/security/mfa/${id}/enroll/`}
                            size="small"
                            priority="primary"
                            className="enroll-button"
                          >
                            {t('Add')}
                          </Button>
                        )}
                        {!isBackupInterface && !isEnrolled && !hasVerifiedEmail && (
                          <Button
                            onClick={this.handleAdd2FAClicked}
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
                              <Button
                                size="small"
                                aria-label={t('delete')}
                                icon={<IconDelete />}
                              />
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
  gap: ${space(1)};
`;

const AuthenticatorStatus = styled(CircleIndicator)`
  margin-right: ${space(1)};
`;

const Description = styled(TextBlock)`
  margin-top: ${space(2)};
  margin-bottom: 0;
`;

export default AccountSecurity;
