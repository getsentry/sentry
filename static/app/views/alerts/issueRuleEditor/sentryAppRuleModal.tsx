import {Fragment} from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {tct} from 'app/locale';
import SentryAppExternalForm, {
  Config,
} from 'app/views/organizationIntegrations/sentryAppExternalForm';

type Props = ModalRenderProps & {
  sentryAppInstallationUuid: string;
  appName: string;
  config: Config;
  action: 'create' | 'update';
  onSubmitSuccess: Function;
};

const SentryAppRuleModal = ({
  Header,
  Body,
  sentryAppInstallationUuid,
  appName,
  config,
  action,
  onSubmitSuccess,
}: Props) => (
  <Fragment>
    <Header closeButton>{tct('[name] Settings', {name: appName})}</Header>
    <Body>
      <SentryAppExternalForm
        sentryAppInstallationUuid={sentryAppInstallationUuid}
        appName={appName}
        element="alert-rule-action"
        config={config}
        action={action}
        onSubmitSuccess={onSubmitSuccess}
        // TODO(leander): Add new defaulting fields for alerts
      />
    </Body>
  </Fragment>
);

export default SentryAppRuleModal;
