import {Fragment} from 'react';
import styled from '@emotion/styled';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {LinkButton} from '@sentry/scraps/button';
import {AutoSaveField, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Link} from '@sentry/scraps/link';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useApiQuery} from 'sentry/utils/queryClient';
import withOrganizations from 'sentry/utils/withOrganizations';
import type {NotificationSettingsType} from 'sentry/views/settings/account/notifications/constants';
import {
  NOTIFICATION_FEATURE_MAP,
  NOTIFICATION_SETTINGS_PATHNAMES,
  NOTIFICATION_SETTINGS_TYPES,
} from 'sentry/views/settings/account/notifications/constants';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const NOTIFICATIONS_ENDPOINT = getApiUrl('/users/$userId/notifications/', {
  path: {userId: 'me'},
});

const notificationSchema = z.object({
  personalActivityNotifications: z.boolean(),
  selfAssignOnResolve: z.boolean(),
});

type NotificationFields = z.infer<typeof notificationSchema>;

interface NotificationSettingsProps {
  organizations: Organization[];
}

function NotificationSettings({organizations}: NotificationSettingsProps) {
  const checkFeatureFlag = (flag: string) => {
    return organizations.some(org => org.features?.includes(flag));
  };
  const notificationFields = NOTIFICATION_SETTINGS_TYPES.filter(type => {
    const notificationFlag = NOTIFICATION_FEATURE_MAP[type];
    if (Array.isArray(notificationFlag)) {
      return notificationFlag.some(flag => checkFeatureFlag(flag));
    }
    if (notificationFlag) {
      return checkFeatureFlag(notificationFlag);
    }
    return true;
  });

  const renderOneSetting = (type: NotificationSettingsType) => {
    const field = NOTIFICATION_SETTING_FIELDS[type];
    if (type === 'quota' && checkFeatureFlag('spend-visibility-notifications')) {
      field.label = t('Spend');
      field.help = t('Notifications that help avoid surprise invoices.');
    }
    return (
      <FieldWrapper key={type}>
        <div>
          <FieldLabel>{field.label as React.ReactNode}</FieldLabel>
          <FieldHelp>{field.help as React.ReactNode}</FieldHelp>
        </div>
        <IconWrapper>
          <LinkButton
            size="sm"
            data-test-id="fine-tuning"
            to={`/settings/account/notifications/${NOTIFICATION_SETTINGS_PATHNAMES[type]}/`}
          >
            {t('Manage')}
          </LinkButton>
        </IconWrapper>
      </FieldWrapper>
    );
  };

  // use 0 as stale time because we change the values elsewhere
  const {
    data: initialData,
    isPending,
    isError,
    refetch,
  } = useApiQuery<NotificationFields>([NOTIFICATIONS_ENDPOINT], {
    staleTime: 0,
  });

  const notificationMutationOptions = mutationOptions({
    mutationFn: (data: Partial<NotificationFields>) => {
      return fetchMutation({
        method: 'PUT',
        url: NOTIFICATIONS_ENDPOINT,
        data,
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Notification preferences saved'));
    },
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Notifications')} />
      <SettingsPageHeader title={t('Notifications')} />
      <FormSearch route="/settings/account/notifications/">
        <TextBlock>
          {tct(
            'Personal notifications sent by email or an integration. Looking to add or remove an email address? [link:Update your email settings.]',
            {
              link: <Link to="/settings/account/emails" />,
            }
          )}
        </TextBlock>
        {isError && <LoadingError onRetry={refetch} />}
        <Panel>
          <PanelHeader>{t('Notification')}</PanelHeader>
          <PanelBody>{notificationFields.map(renderOneSetting)}</PanelBody>
        </Panel>
        {isPending && <LoadingIndicator />}
        {initialData && (
          <FieldGroup title={t('My Activity')}>
            <AutoSaveField
              name="personalActivityNotifications"
              schema={notificationSchema}
              initialValue={initialData.personalActivityNotifications}
              mutationOptions={notificationMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('My Own Activity')}
                  hintText={t('Notifications about your own actions on Sentry.')}
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveField>
            <AutoSaveField
              name="selfAssignOnResolve"
              schema={notificationSchema}
              initialValue={initialData.selfAssignOnResolve}
              mutationOptions={notificationMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('Resolve and Auto-Assign')}
                  hintText={t(
                    "When you resolve an unassigned issue, we'll auto-assign it to you."
                  )}
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveField>
          </FieldGroup>
        )}
      </FormSearch>
    </Fragment>
  );
}
export default withOrganizations(NotificationSettings);

const FieldLabel = styled('div')`
  font-size: ${p => p.theme.font.size.md};
`;

const FieldHelp = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const FieldWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content;
  padding: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const IconWrapper = styled('div')`
  display: flex;
  margin: auto;
  cursor: pointer;
`;
