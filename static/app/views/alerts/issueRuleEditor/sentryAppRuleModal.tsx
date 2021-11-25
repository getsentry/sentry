import {Fragment} from 'react';

import {closeModal, ModalRenderProps} from 'sentry/actionCreators/modal';
import {tct} from 'sentry/locale';
import SentryAppExternalForm, {
  SchemaFormConfig,
} from 'sentry/views/organizationIntegrations/sentryAppExternalForm';

type Props = ModalRenderProps & {
  sentryAppInstallationUuid: string;
  appName: string;
  config: SchemaFormConfig;
  resetValues: {[key: string]: any};
  onSubmitSuccess: React.ComponentProps<typeof SentryAppExternalForm>['onSubmitSuccess'];
};

const SentryAppRuleModal = ({
  Header,
  Body,
  sentryAppInstallationUuid,
  appName,
  config,
  resetValues,
  onSubmitSuccess,
}: Props) => (
  <Fragment>
    <Header closeButton>{tct('[name] Settings', {name: appName})}</Header>
    <Body>
      <SentryAppExternalForm
        sentryAppInstallationUuid={sentryAppInstallationUuid}
        appName={appName}
        config={config}
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

export default SentryAppRuleModal;
