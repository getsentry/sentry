import {RouteComponentProps} from 'react-router';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openEmailVerification} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Authenticator, OrganizationSummary} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import AsyncView from 'sentry/views/asyncView';
import RemoveConfirm from 'sentry/views/settings/account/accountSecurity/components/removeConfirm';
import TwoFactorRequired from 'sentry/views/settings/account/accountSecurity/components/twoFactorRequired';
import PasswordForm from 'sentry/views/settings/account/passwordForm';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

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
                  <Field
                    key={id}
                    alignRight
                    flexibleControlStateSize
                    label={name}
                    help={description}
                  >
                    <Panel>
                      {!isBackupInterface && !isEnrolled && hasVerifiedEmail && (
                        <div>
                          <Button
                            to={`/settings/account/security/mfa/${id}/enroll/`}
                            priority="primary"
                            className="enroll-button"
                          >
                            {t('Add')}
                          </Button>
                        </div>
                      )}
                      {!isBackupInterface && !isEnrolled && !hasVerifiedEmail && (
                        <Button
                          onClick={this.handleAdd2FAClicked}
                          priority="primary"
                          className="enroll-button"
                        >
                          {t('Add')}
                        </Button>
                      )}

                      {isEnrolled && authId && (
                        <Button
                          to={`/settings/account/security/mfa/${authId}/`}
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
                    </Panel>

                    {isBackupInterface && !isEnrolled ? t('requires 2FA') : null}
                  </Field>
                );
              })}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default AccountSecurity;
