import {Fragment} from 'react';

import {closeModal, ModalRenderProps} from 'app/actionCreators/modal';
import {tct} from 'app/locale';
import SentryAppExternalForm, {
  Config,
} from 'app/views/organizationIntegrations/sentryAppExternalForm';

type Props = ModalRenderProps & {
  sentryAppInstallationUuid: string;
  appName: string;
  config: Config;
  resetValues: {[key: string]: any};
  onSubmitSuccess: Function;
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
          closeModal();
          onSubmitSuccess(...params);
        }}
        resetValues={resetValues}
      />
    </Body>
  </Fragment>
);

export default SentryAppRuleModal;
