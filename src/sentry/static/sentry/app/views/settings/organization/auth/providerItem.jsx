import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from '../../../../locale';
import Button from '../../../../components/buttons/button';
import PanelItem from '../../components/panelItem';

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
          <Box flex="1">
            <h4>{providerName}</h4>
            <div>
              {tct('Enable your organization to sign in with [providerName]', {
                providerName,
              })}
              .
            </div>
          </Box>
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

const ProviderLogo = styled.div`
  height: 48px;
  width: 48px;
  border-radius: 3px;
`;
