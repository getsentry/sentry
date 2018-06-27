import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import IndicatorStore from 'app/stores/indicatorStore';
import Tooltip from 'app/components/tooltip';

function computeCenteredWindow(width, height) {
  const screenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
  const screenTop = window.screenTop != undefined ? window.screenTop : screen.top;
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

export default class AddIntegrationButton extends React.Component {
  static propTypes = {
    provider: PropTypes.object.isRequired,
    onAddIntegration: PropTypes.func.isRequired,
  };

  componentDidMount() {
    this.dialog = null;
    window.addEventListener('message', this.receiveMessage, false);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.receiveMessage);

    if (this.dialog !== null) {
      this.dialog.close();
    }
  }

  handleAddIntegration = provider => {
    const name = 'sentryAddIntegration';

    const {url, width, height} = provider.setupDialog;
    const {left, top} = computeCenteredWindow(width, height);

    this.dialog = window.open(
      url,
      name,
      `scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`
    );

    this.dialog.focus();
  };

  receiveMessage = message => {
    if (message.origin !== document.origin) {
      return;
    }

    if (message.source !== this.dialog) {
      return;
    }

    this.dialog = null;

    const {success, data} = message.data;

    if (!success) {
      IndicatorStore.addError(data['error']);
      return;
    }

    this.props.onAddIntegration(data);
    IndicatorStore.addSuccess(t('Integration Added'));
  };

  render() {
    // eslint-disable-next-line no-unused-vars
    const {provider, onAddIntegration, ...buttonProps} = this.props;

    return (
      <Tooltip
        disabled={provider.canAdd}
        tooltipOptions={{placement: 'left'}}
        title={`Integration cannot be added on Sentry. Enable this integration via the ${provider.name} instance.`}
      >
        <span>
          <Button
            {...buttonProps}
            disabled={!provider.canAdd}
            onClick={() => this.handleAddIntegration(provider)}
          >
            <span className="icon icon-add" /> {t('Add') + ' ' + provider.metadata.noun}
          </Button>
        </span>
      </Tooltip>
    );
  }
}
