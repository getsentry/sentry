import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import {PanelItem} from 'app/components/panels';

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
        <ProviderLogo className={`provider-logo ${providerName.toLowerCase()}`} />
        <Box px={2} flex={1}>
          <ProviderName>{providerName}</ProviderName>
          <ProviderDetails>
            {t('Enable your organization to sign in with %s.', providerName)}
          </ProviderDetails>
        </Box>
        <Box>
          <Button
            type="submit"
            name="provider"
            size="small"
            value={providerKey}
            onClick={this.handleConfigure}
          >
            {t('Configure')}
          </Button>
        </Box>
      </PanelItem>
    );
  }
}

const ProviderLogo = styled('div')`
  height: 36px;
  width: 36px;
  border-radius: 3px;
  margin-right: 0;
  top: auto;
`;

const ProviderName = styled('div')`
  font-weight: bold;
`;

const ProviderDetails = styled('div')`
  margin-top: 6px;
  font-size: 0.8em;
`;
