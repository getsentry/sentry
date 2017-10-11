import PropTypes from 'prop-types';
import React from 'react';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';

export default class ProviderItem extends React.PureComponent {
  static propTypes = {
    providerKey: PropTypes.string.isRequired,
    providerName: PropTypes.string.isRequired,
    onConfigure: PropTypes.func.isRequired,
  };

  static defaultProps = {
    onConfigure: () => {},
  };

  handleConfigure = e => {
    this.props.onConfigure(this.props.providerKey, e);
  };

  render() {
    let {providerKey, providerName} = this.props;
    return (
      <li key={providerKey}>
        <div className={`provider-logo ${providerName.toLowerCase()}`} />
        <Button onClick={this.handleConfigure} className="pull-right">
          {t('Configure')}
        </Button>
        <h4>{providerName}</h4>
        <p>
          {tct('Enable your organization to sign in with [providerName]', {providerName})}
          .
        </p>
      </li>
    );
  }
}
