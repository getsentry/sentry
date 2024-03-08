import {Fragment} from 'react';
import styled from '@emotion/styled';

import AlertLink from 'sentry/components/alertLink';
import {LinkButton} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldObject} from 'sentry/components/forms/types';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMail, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import withOrganizations from 'sentry/utils/withOrganizations';
import {
  NOTIFICATION_FEATURE_MAP,
  NOTIFICATION_SETTINGS_PATHNAMES,
  NOTIFICATION_SETTINGS_TYPES,
  SELF_NOTIFICATION_SETTINGS_TYPES,
} from 'sentry/views/settings/account/notifications/constants';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields2';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

interface NotificationSettingsProps {
  organizations: Organization[];
}

function NotificationSettings({organizations}: NotificationSettingsProps) {
  const checkFeatureFlag = (flag: string) => {
    return organizations.some(org => org.features?.includes(flag));
  };
  const notificationFields = NOTIFICATION_SETTINGS_TYPES.filter(type => {
    const notificationFlag = NOTIFICATION_FEATURE_MAP[type];
    if (notificationFlag) {
      return checkFeatureFlag(notificationFlag);
    }
    return true;
  });

  const renderOneSetting = (type: string) => {
    const field = NOTIFICATION_SETTING_FIELDS[type];
    return (
      <FieldWrapper key={type}>
        <div>
          <FieldLabel>{field.label as React.ReactNode}</FieldLabel>
          <FieldHelp>{field.help as React.ReactNode}</FieldHelp>
        </div>
        <IconWrapper>
          <LinkButton
            icon={<IconSettings size="sm" />}
            size="sm"
            borderless
            aria-label={t('Notification Settings')}
            data-test-id="fine-tuning"
            to={`/settings/account/notifications/${NOTIFICATION_SETTINGS_PATHNAMES[type]}/`}
          />
        </IconWrapper>
      </FieldWrapper>
    );
  };

  const legacyFields = SELF_NOTIFICATION_SETTINGS_TYPES.map(
    type => NOTIFICATION_SETTING_FIELDS[type] as FieldObject
  );

  // use 0 as stale time because we change the values elsewhere
  const {
    data: initialLegacyData,
    isLoading,
    isError,
    isSuccess,
    refetch,
  } = useApiQuery<{[key: string]: string}>(['/users/me/notifications/'], {
    staleTime: 0,
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Notifications')} />
      <SettingsPageHeader title={t('Notifications')} />
      <TextBlock>
        {t('Personal notifications sent by email or an integration.')}
      </TextBlock>
      {isError && <LoadingError onRetry={refetch} />}
      <PanelNoBottomMargin>
        <PanelHeader>{t('Notification')}</PanelHeader>
        <PanelBody>{notificationFields.map(renderOneSetting)}</PanelBody>
      </PanelNoBottomMargin>
      <BottomFormWrapper>
        {isLoading && (
          <Panel>
            {new Array(2).fill(0).map((_, idx) => (
              <PanelItem key={idx}>
                <Placeholder height="38px" />
              </PanelItem>
            ))}
          </Panel>
        )}
        {isSuccess && (
          <Form
            saveOnBlur
            apiMethod="PUT"
            apiEndpoint="/users/me/notifications/"
            initialData={initialLegacyData}
          >
            <JsonForm fields={legacyFields} />
          </Form>
        )}
      </BottomFormWrapper>
      <AlertLink to="/settings/account/emails" icon={<IconMail />}>
        {t('Looking to add or remove an email address? Use the emails panel.')}
      </AlertLink>
    </Fragment>
  );
}
export default withOrganizations(NotificationSettings);

const FieldLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const FieldHelp = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const FieldWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr min-content;
  padding: ${p => p.theme.grid * 2}px;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const IconWrapper = styled('div')`
  display: flex;
  margin: auto;
  cursor: pointer;
`;

const BottomFormWrapper = styled('div')`
  ${Panel} {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top: 0;
  }
`;

const PanelNoBottomMargin = styled(Panel)`
  margin-bottom: 0;
  border-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
`;
