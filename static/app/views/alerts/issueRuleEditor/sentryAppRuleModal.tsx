import {Component, Fragment} from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {tct} from 'app/locale';
import SentryAppExternalForm, {
  Config,
} from 'app/views/organizationIntegrations/sentryAppExternalForm';

type Props = ModalRenderProps & {
  sentryAppInstallationId: string;
  appName: string;
  config: Config;
  action: 'create' | 'update';
  onSubmitSuccess: (...params: any[]) => void;
};

class SentryAppRuleModal extends Component<Props> {
  render() {
    const {Header, Body, sentryAppInstallationId, appName, config, action} = this.props;
    return (
      <Fragment>
        <Header closeButton>{tct('[name] Settings', {name: appName})}</Header>
        <Body>
          <SentryAppExternalForm
            sentryAppInstallationId={sentryAppInstallationId}
            appName={appName}
            element="alert-rule-action"
            config={config}
            action={action}
            onSubmitSuccess={this.props.onSubmitSuccess}
            // TODO(leander): Add new defaulting fields for alerts
          />
        </Body>
      </Fragment>
    );
  }
}

export default SentryAppRuleModal;
