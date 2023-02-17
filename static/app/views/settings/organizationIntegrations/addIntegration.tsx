import {Component} from 'react';
import * as qs from 'query-string';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {NODE_ENV} from 'sentry/constants';
import {t} from 'sentry/locale';
import {IntegrationProvider, IntegrationWithConfig, Organization} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

type Props = {
  children: (
    openDialog: (urlParams?: {[key: string]: string}) => void
  ) => React.ReactNode;
  onInstall: (data: IntegrationWithConfig) => void;
  organization: Organization;
  provider: IntegrationProvider;
  account?: string; // for analytics
  analyticsParams?: {
    already_installed: boolean;
    view:
      | 'integrations_directory_integration_detail'
      | 'integrations_directory'
      | 'onboarding'
      | 'project_creation';
  };
  modalParams?: {[key: string]: string};
};

export default class AddIntegration extends Component<Props> {
  componentDidMount() {
    window.addEventListener('message', this.didReceiveMessage);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.didReceiveMessage);
    this.dialog?.close();
  }

  dialog: Window | null = null;

  computeCenteredWindow(width: number, height: number) {
    // Taken from: https://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
    const screenLeft =
      window.screenLeft !== undefined ? window.screenLeft : window.screenX;

    const screenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;

    const innerWidth = window.innerWidth
      ? window.innerWidth
      : document.documentElement.clientWidth
      ? document.documentElement.clientWidth
      : screen.width;

    const innerHeight = window.innerHeight
      ? window.innerHeight
      : document.documentElement.clientHeight
      ? document.documentElement.clientHeight
      : screen.height;

    const left = innerWidth / 2 - width / 2 + screenLeft;
    const top = innerHeight / 2 - height / 2 + screenTop;

    return {left, top};
  }

  openDialog = (urlParams?: {[key: string]: string}) => {
    const {account, analyticsParams, modalParams, organization, provider} = this.props;

    trackIntegrationAnalytics('integrations.installation_start', {
      integration: provider.key,
      integration_type: 'first_party',
      organization,
      ...analyticsParams,
    });
    const name = 'sentryAddIntegration';
    const {url, width, height} = provider.setupDialog;
    const {left, top} = this.computeCenteredWindow(width, height);

    let query: {[key: string]: string} = {...urlParams};

    if (account) {
      query.account = account;
    }

    if (modalParams) {
      query = {...query, ...modalParams};
    }

    const installUrl = `${url}?${qs.stringify(query)}`;
    const opts = `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;

    this.dialog = window.open(installUrl, name, opts);
    this.dialog && this.dialog.focus();
  };

  didReceiveMessage = (message: MessageEvent) => {
    const {analyticsParams, onInstall, organization, provider} = this.props;

    // TODO: Would be better if we could mock document.location.origin to '' in
    // the tests. jsdom's window.postMessage doesn't set an origin
    if (message.origin !== document.location.origin && NODE_ENV === 'production') {
      return;
    }

    if (message.source !== this.dialog) {
      return;
    }

    const {success, data} = message.data;
    this.dialog = null;

    if (!success) {
      addErrorMessage(data.error);
      return;
    }

    if (!data) {
      return;
    }
    trackIntegrationAnalytics('integrations.installation_complete', {
      integration: provider.key,
      integration_type: 'first_party',
      organization,
      ...analyticsParams,
    });
    addSuccessMessage(t('%s added', provider.name));
    onInstall(data);
  };

  render() {
    const {children} = this.props;

    return children(this.openDialog);
  }
}
