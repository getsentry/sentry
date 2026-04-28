import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import {tct} from 'sentry/locale';
import {
  SentryAppExternalForm,
  type SentryAppExternalFormAlertRuleSubmitPayload,
  type SentryAppExternalFormResetValues,
  type SchemaFormConfig,
} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

type RuleModalResetValues = SentryAppExternalFormResetValues & {
  formFields?: SchemaFormConfig;
} & Record<string, unknown>;

type Props = ModalRenderProps & {
  appName: string;
  config: SchemaFormConfig;
  onSubmitSuccess: (response: SentryAppExternalFormAlertRuleSubmitPayload) => void;
  resetValues: RuleModalResetValues;
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
  return (
    <Fragment>
      <Header closeButton>
        <div>{tct('[name] Settings', {name: appName})}</div>
        {config.description && <Description>{config.description}</Description>}
      </Header>
      <Body>
        <SentryAppExternalForm
          sentryAppInstallationUuid={sentryAppInstallationUuid}
          appName={appName}
          config={resetValues?.formFields || config}
          element="alert-rule-action"
          action="create"
          onSubmitSuccess={response => {
            onSubmitSuccess(response);
            closeModal();
          }}
          resetValues={{settings: resetValues?.settings}}
        />
      </Body>
    </Fragment>
  );
}

const Description = styled('div')`
  padding-top: 0;
  color: ${p => p.theme.tokens.content.secondary};
`;
