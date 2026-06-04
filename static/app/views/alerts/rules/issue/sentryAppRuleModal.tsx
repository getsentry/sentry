import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import {tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import SentryAppExternalForm, {
  type SchemaFormConfig,
} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';
import {SentryAppExternalFormNew} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm.new';

type OnSubmitSuccess = (
  response: any,
  instance?: unknown,
  id?: string,
  change?: {new: unknown; old: unknown}
) => void;

type Props = ModalRenderProps & {
  appName: string;
  config: SchemaFormConfig;
  onSubmitSuccess: OnSubmitSuccess;
  resetValues: Record<string, any>;
  sentryAppInstallationUuid: string;
};

export function SentryAppRuleModal({
  Header,
  Body,
  sentryAppInstallationUuid,
  appName,
  config,
  resetValues,
  onSubmitSuccess,
}: Props) {
  const organization = useOrganization();
  const useNewForm = organization.features.includes('sentry-app-schema-form-migration');
  const handleSubmitSuccess: OnSubmitSuccess = (...params) => {
    onSubmitSuccess(...params);
    closeModal();
  };
  const formConfig = resetValues?.formFields || config;

  return (
    <Fragment>
      <Header closeButton>
        <div>{tct('[name] Settings', {name: appName})}</div>
        {config.description && <Description>{config.description}</Description>}
      </Header>
      <Body>
        {useNewForm ? (
          <SentryAppExternalFormNew
            sentryAppInstallationUuid={sentryAppInstallationUuid}
            appName={appName}
            config={
              formConfig as React.ComponentProps<
                typeof SentryAppExternalFormNew
              >['config']
            }
            element="alert-rule-action"
            action="create"
            onSubmitSuccess={handleSubmitSuccess}
            resetValues={{settings: resetValues?.settings}}
          />
        ) : (
          <SentryAppExternalForm
            sentryAppInstallationUuid={sentryAppInstallationUuid}
            appName={appName}
            config={formConfig}
            element="alert-rule-action"
            action="create"
            onSubmitSuccess={handleSubmitSuccess}
            resetValues={{settings: resetValues?.settings}}
          />
        )}
      </Body>
    </Fragment>
  );
}

const Description = styled('div')`
  padding-top: 0;
  color: ${p => p.theme.tokens.content.secondary};
`;
