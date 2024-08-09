import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {closeModal} from 'sentry/actionCreators/modal';
import {tct} from 'sentry/locale';
import type {SchemaFormConfig} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';
import SentryAppExternalForm from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

type Props = ModalRenderProps & {
  appName: string;
  config: SchemaFormConfig;
  onSubmitSuccess: React.ComponentProps<typeof SentryAppExternalForm>['onSubmitSuccess'];
  resetValues: {[key: string]: any};
  sentryAppInstallationUuid: string;
};

function SentryAppRuleModal({
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
          onSubmitSuccess={(...params) => {
            onSubmitSuccess(...params);
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
  color: ${p => p.theme.subText};
`;

export default SentryAppRuleModal;
