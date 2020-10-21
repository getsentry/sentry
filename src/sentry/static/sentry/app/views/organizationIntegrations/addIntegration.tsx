import PropTypes from 'prop-types';
import * as React from 'react';
import * as queryString from 'query-string';

import {IntegrationProvider, IntegrationWithConfig, Organization} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';

type Props = {
  children: (
    openDialog: (urlParams?: {[key: string]: string}) => void
  ) => React.ReactNode;
  provider: IntegrationProvider;
  onInstall: (data: IntegrationWithConfig) => void;
  integrationId?: string;
  account?: string;
  organization?: Organization; //for analytics
  analyticsParams?: {
    view: 'integrations_directory_integration_detail' | 'integrations_directory';
    already_installed: boolean;
  };
};

export default class AddIntegration extends React.Component<Props> {
  static propTypes = {
    children: PropTypes.func.isRequired,
    provider: PropTypes.object.isRequired,
    onInstall: PropTypes.func.isRequired,
    integrationId: PropTypes.string,
    account: PropTypes.string,
    organization: SentryTypes.Organization,
  };

  componentDidMount() {
    window.addEventListener('message', this.didReceiveMessage);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.didReceiveMessage);
    this.dialog && this.dialog.close();
  }

  dialog: Window | null = null;

  computeCenteredWindow(width: number, height: number) {
    //Taken from: https://stackoverflow.com/questions/4068373/center-a-popup-window-on-screen
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
    const {integrationId} = this.props;
    //if we have the integrationId, it's used for the re-auth flow
    trackIntegrationEvent(
      {
        eventKey: integrationId
          ? 'integrations.reauth_start'
          : 'integrations.installation_start',
        eventName: integrationId
          ? 'Integrations: Reauth Start'
          : 'Integrations: Installation Start',
        integration: this.props.provider.key,
        integration_type: 'first_party',
        ...this.props.analyticsParams,
      },
      this.props.organization
    );
    const name = 'sentryAddIntegration';
    const {url, width, height} = this.props.provider.setupDialog;
    const {left, top} = this.computeCenteredWindow(width, height);

    const query: {[key: string]: string} = {...urlParams};

    if (integrationId) {
      query.integration_id = integrationId;
    }

    if (this.props.account) {
      query.account = this.props.account;
    }

    const installUrl = `${url}?${queryString.stringify(query)}`;
    const opts = `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;

    this.dialog = window.open(installUrl, name, opts);
    this.dialog && this.dialog.focus();
  };

  didReceiveMessage = (message: MessageEvent) => {
    const {integrationId} = this.props;
    if (message.origin !== document.location.origin) {
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
    this.props.onInstall(data);
    trackIntegrationEvent(
      {
        eventKey: integrationId
          ? 'integrations.reauth_complete'
          : 'integrations.installation_complete',
        eventName: integrationId
          ? 'Integrations: Reauth Complete'
          : 'Integrations: Installation Complete',
        integration: this.props.provider.key,
        integration_type: 'first_party',
        ...this.props.analyticsParams,
      },
      this.props.organization
    );
    addSuccessMessage(t('%s added', this.props.provider.name));
  };

  render() {
    return this.props.children(this.openDialog);
  }
}
