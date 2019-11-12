import PropTypes from 'prop-types';
import React from 'react';
import queryString from 'query-string';

import {t} from 'app/locale';
import IndicatorStore from 'app/stores/indicatorStore';

export default class AddIntegration extends React.Component {
  static propTypes = {
    children: PropTypes.func.isRequired,
    provider: PropTypes.object.isRequired,
    onInstall: PropTypes.func.isRequired,
    reinstallId: PropTypes.string,
    account: PropTypes.string,
  };

  componentDidMount() {
    this.dialog = null;
    window.addEventListener('message', this.didReceiveMessage);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.didReceiveMessage);
    this.dialog && this.dialog.close();
  }

  computeCenteredWindow(width, height) {
    const screenLeft = window.screenLeft !== undefined ? window.screenLeft : screen.left;

    const screenTop = window.screenTop !== undefined ? window.screenTop : screen.top;

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

  openDialog = urlParams => {
    const name = 'sentryAddIntegration';
    const {url, width, height} = this.props.provider.setupDialog;
    const {left, top} = this.computeCenteredWindow(width, height);

    const query = {...urlParams};

    if (this.props.reinstallId) {
      query.reinstall_id = this.props.reinstallId;
    }

    if (this.props.account) {
      query.account = this.props.account;
    }

    const installUrl = `${url}?${queryString.stringify(query)}`;
    const opts = `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;

    this.dialog = window.open(installUrl, name, opts);
    this.dialog.focus();
  };

  didReceiveMessage = message => {
    if (message.origin !== document.location.origin) {
      return;
    }

    if (message.source !== this.dialog) {
      return;
    }

    const {success, data} = message.data;
    this.dialog = null;

    if (!success) {
      IndicatorStore.addError(data.error);
      return;
    }

    if (!data) {
      return;
    }
    this.props.onInstall(data);
    IndicatorStore.addSuccess(t(`${this.props.provider.name} added`));
  };

  render() {
    return this.props.children(this.openDialog);
  }
}
