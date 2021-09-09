import {Component, Fragment} from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {tct} from 'app/locale';
import {SentryAppInstallation} from 'app/types';
import SentryAppExternalForm, {
  Config,
} from 'app/views/organizationIntegrations/sentryAppExternalForm';

type Props = ModalRenderProps & {
  sentryAppInstallation: SentryAppInstallation;
  appName: string;
  config: Config;
  action: 'create' | 'update';
  //   extraFields?: {[key: string]: any};
  //   extraRequestBody?: {[key: string]: any};
  onSubmitSuccess: (...params: any[]) => void;
};

class SentryAppRuleModal extends Component<Props> {
  render() {
    const {Header, Body, sentryAppInstallation, appName, config, action} = this.props;
    return (
      <Fragment>
        <Header closeButton>{tct('[name] Settings', {name: 'TODO Integration'})}</Header>
        <Body>
          {config?.uri === 'asdf' && (
            <SentryAppExternalForm
              sentryAppInstallation={sentryAppInstallation}
              appName={appName}
              element="alert-rule-action"
              config={config}
              action={action}
              onSubmitSuccess={this.props.onSubmitSuccess}
              // TODO(leander): Add new defaulting fields for alerts
            />
          )}
          <p>testing</p>
        </Body>
      </Fragment>
    );
  }
}

export default SentryAppRuleModal;
