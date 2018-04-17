import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import {PanelItem} from '../../../../components/panels';
import {Flex} from '../../../../components/grid';

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
    if (typeof this.props.onConfigure === 'function') {
      this.props.onConfigure(this.props.providerKey, e);
    }
  };

  render() {
    let {providerKey, providerName} = this.props;
    return (
      <PanelItem align="center">
        <Flex flex="1">
          <ProviderLogo className={`provider-logo ${providerName.toLowerCase()}`} />
          <Flex direction="column" justify="space-around" flex="1">
            <ProviderName>{providerName}</ProviderName>
            <div>
              {tct('Enable your organization to sign in with [providerName]', {
                providerName,
              })}
              .
            </div>
          </Flex>
        </Flex>

        <Button
          type="submit"
          name="provider"
          value={providerKey}
          onClick={this.handleConfigure}
        >
          {t('Configure')}
        </Button>
      </PanelItem>
    );
  }
}

const ProviderName = styled.div`
  font-size: 22px;
`;

const ProviderLogo = styled.div`
  height: 48px;
  width: 48px;
  border-radius: 3px;
  top: auto;
`;
