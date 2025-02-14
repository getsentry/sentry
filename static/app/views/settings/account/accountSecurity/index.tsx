import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openEmailVerification} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import CircleIndicator from 'sentry/components/circleIndicator';
import EmptyMessage from 'sentry/components/emptyMessage';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Authenticator} from 'sentry/types/auth';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {OrganizationSummary} from 'sentry/types/organization';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import recreateRoute from 'sentry/utils/recreateRoute';
import useApi from 'sentry/utils/useApi';
import RemoveConfirm from 'sentry/views/settings/account/accountSecurity/components/removeConfirm';
import TwoFactorRequired from 'sentry/views/settings/account/accountSecurity/components/twoFactorRequired';
import PasswordForm from 'sentry/views/settings/account/passwordForm';
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
} & RouteComponentProps;

/**
 * Lists 2fa devices + password change form
 */
function AccountSecurity({
  authenticators,
  countEnrolled,
  deleteDisabled,
  onDisable,
  hasVerifiedEmail,
  orgsRequire2fa,
  handleRefresh,
  params,
  routes,
}: Props) {
  const api = useApi();

  async function handleSessionClose() {
    try {
      await api.requestPromise('/auth/', {
        method: 'DELETE',
        data: {all: true},
      });
      window.location.assign('/auth/login/');
    } catch (err) {
      addErrorMessage(t('There was a problem closing all sessions'));
      throw err;
    }
  }

  const formatOrgSlugs = () => {
    const slugs = orgsRequire2fa.map(({slug}) => slug);

    return oxfordizeArray(slugs);
  };

  const handleAdd2FAClicked = () => {
    openEmailVerification({
      onClose: () => {
        handleRefresh();
      },
      actionMessage: 'enrolling a 2FA device',
    });
  };

  const isEmpty = !authenticators?.length;

  return (
    <SentryDocumentTitle title={t('Security')}>
      <SettingsPageHeader
        title={t('Security')}
        tabs={
          <NavTabs underlined>
            <ListLink to={recreateRoute('', {params, routes})} index>
              {t('Settings')}
            </ListLink>
            <ListLink to={recreateRoute('session-history/', {params, routes})}>
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
          <FieldGroup
            alignRight
            flexibleControlStateSize
            label={t('Sign out of all devices')}
            help={t(
              'Signing out of all devices will sign you out of this device as well.'
            )}
          >
            <Button onClick={handleSessionClose}>{t('Sign out of all devices')}</Button>
          </FieldGroup>
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
                disallowNewEnrollment,
                configureButton,
                name,
              } = auth;
              if (disallowNewEnrollment && !isEnrolled) {
                return null;
              }
              return (
                <AuthenticatorPanelItem key={id}>
                  <AuthenticatorHeader>
                    <AuthenticatorTitle>
                      <AuthenticatorStatus
                        role="status"
                        aria-label={
                          isEnrolled
                            ? t('Authentication Method Active')
                            : t('Authentication Method Inactive')
                        }
                        enabled={isEnrolled}
                      />
                      <AuthenticatorName>{name}</AuthenticatorName>
                    </AuthenticatorTitle>

                    <Actions>
                      {!isBackupInterface && !isEnrolled && hasVerifiedEmail && (
                        <LinkButton
                          to={`/settings/account/security/mfa/${id}/enroll/`}
                          size="sm"
                          priority="primary"
                        >
                          {t('Add')}
                        </LinkButton>
                      )}
                      {!isBackupInterface && !isEnrolled && !hasVerifiedEmail && (
                        <Button
                          onClick={handleAdd2FAClicked}
                          size="sm"
                          priority="primary"
                        >
                          {t('Add')}
                        </Button>
                      )}

                      {isEnrolled && authId && (
                        <LinkButton
                          to={`/settings/account/security/mfa/${authId}/`}
                          size="sm"
                        >
                          {configureButton}
                        </LinkButton>
                      )}

                      {!isBackupInterface && isEnrolled && (
                        <Tooltip
                          title={t(
                            `Two-factor authentication is required for organization(s): %s.`,
                            formatOrgSlugs()
                          )}
                          disabled={!deleteDisabled}
                        >
                          <RemoveConfirm
                            onConfirm={() => onDisable(auth)}
                            disabled={deleteDisabled}
                          >
                            <Button
                              size="sm"
                              aria-label={t('Delete')}
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
    </SentryDocumentTitle>
  );
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
