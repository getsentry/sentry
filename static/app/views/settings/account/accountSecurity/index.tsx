import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openEmailVerification} from 'sentry/actionCreators/modal';
import CircleIndicator from 'sentry/components/circleIndicator';
import Confirm from 'sentry/components/confirm';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import EmptyMessage from 'sentry/components/emptyMessage';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import useApi from 'sentry/utils/useApi';
import {useAccountSecurityContext} from 'sentry/views/settings/account/accountSecurity/accountSecurityWrapper';
import RemoveConfirm from 'sentry/views/settings/account/accountSecurity/components/removeConfirm';
import TwoFactorRequired from 'sentry/views/settings/account/accountSecurity/components/twoFactorRequired';
import PasswordForm from 'sentry/views/settings/account/passwordForm';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

/**
 * Lists 2fa devices + password change form
 */
export default function AccountSecurity() {
  const {
    authenticators,
    countEnrolled,
    deleteDisabled,
    onDisable,
    hasVerifiedEmail,
    orgsRequire2fa,
    handleRefresh,
  } = useAccountSecurityContext();

  const api = useApi();

  async function handleSessionClose() {
    try {
      await api.requestPromise('/auth/', {
        method: 'DELETE',
        data: {all: true},
      });
      testableWindowLocation.assign('/auth/login/');
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

  const maybeTab = location.pathname.split('/').at(-2);
  const activeTab =
    maybeTab === 'settings'
      ? 'settings'
      : maybeTab === 'session-history'
        ? 'sessionHistory'
        : 'settings';

  const routePrefix = `/settings/account/security/`;
  return (
    <SentryDocumentTitle title={t('Security')}>
      <SettingsPageHeader
        title={t('Security')}
        tabs={
          <TabsContainer>
            <Tabs value={activeTab}>
              <TabList>
                <TabList.Item key="settings" to={`${routePrefix}`}>
                  {t('Settings')}
                </TabList.Item>
                <TabList.Item key="sessionHistory" to={`${routePrefix}session-history/`}>
                  {t('Session History')}
                </TabList.Item>
              </TabList>
            </Tabs>
          </TabsContainer>
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
            <Confirm
              onConfirm={handleSessionClose}
              message={t(
                'You will need to re-authenticate on all devices you were previously signed in on. Are you sure?'
              )}
            >
              <Button>{t('Sign out of all devices')}</Button>
            </Confirm>
          </FieldGroup>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('Two-Factor Authentication')}</PanelHeader>
        {isEmpty && (
          <EmptyMessage>{t('No available authenticators to add')}</EmptyMessage>
        )}
        <AuthenticatorList>
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
                  <AuthenticatorDetails>
                    <CircleIndicator
                      role="status"
                      aria-label={
                        isEnrolled
                          ? t('Authentication Method Active')
                          : t('Authentication Method Inactive')
                      }
                      enabled={isEnrolled}
                    />
                    <AuthenticatorTitle>
                      {name}
                      {isBackupInterface && !isEnrolled && (
                        <Tag variant="info">{t('requires 2FA')}</Tag>
                      )}
                    </AuthenticatorTitle>
                    <AuthenticatorDescription>{description}</AuthenticatorDescription>
                  </AuthenticatorDetails>
                  <ButtonBar>
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
                      <Button onClick={handleAdd2FAClicked} size="sm" priority="primary">
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
                      <RemoveConfirm
                        onConfirm={() => onDisable(auth)}
                        disabled={deleteDisabled}
                      >
                        <Button
                          size="sm"
                          aria-label={t('Delete')}
                          icon={<IconDelete />}
                          title={
                            deleteDisabled
                              ? t(
                                  `Two-factor authentication is required for organization(s): %s.`,
                                  formatOrgSlugs()
                                )
                              : undefined
                          }
                        />
                      </RemoveConfirm>
                    )}
                  </ButtonBar>
                </AuthenticatorPanelItem>
              );
            })}
        </AuthenticatorList>
      </Panel>
    </SentryDocumentTitle>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
`;

const AuthenticatorList = styled(PanelBody)`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: 0 ${p => p.theme.space.md};
`;

const AuthenticatorPanelItem = styled(PanelItem)`
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;

  & > :last-child {
    justify-content: end;
  }
`;

const AuthenticatorDetails = styled('div')`
  display: grid;
  grid-template-columns: max-content minmax(auto, 600px);
  gap: ${p => p.theme.space.sm};
  align-items: center;
`;

const AuthenticatorTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const AuthenticatorDescription = styled(TextBlock)`
  grid-column: 2;
  margin: 0;
`;
