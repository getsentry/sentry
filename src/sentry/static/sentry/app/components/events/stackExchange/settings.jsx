import React from 'react';
import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import queryString from 'query-string';

import ToolbarHeader from 'app/components/toolbarHeader';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import {Sticky, StyledFlex} from './styles';

class Settings extends React.Component {
  propTypes = {
    authenticated: PropTypes.bool.isRequired,
    hasAuthenticated: PropTypes.func.isRequired,
  };

  // eslint-disable-next-line react/sort-comp
  popup = null;

  componentDidMount() {
    this._isMounted = true;

    window.addEventListener('message', this.receiveMessage, false);
  }

  componentWillUnmount() {
    this._isMounted = false;
    window.removeEventListener('message', this.receiveMessage, false);
  }

  receiveMessage = event => {
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.source !== this.popup) {
      return;
    }

    if (event.data === 'stackexchange_implicit_oauth_flow_done') {
      if (this.popup) {
        this.popup.close();
        this.popup = null;

        this.props.hasAuthenticated();
      }
    }
  };

  handleAuthenticate = event => {
    event.preventDefault();

    const params = {
      client_id: '15653',
      redirect_uri: `${window.location.origin}/implicitoauth/`,
      scope: 'no_expiry',
    };

    const AUTHORIZATION_URL = `https://stackoverflow.com/oauth/dialog?${queryString.stringify(
      params
    )}`;

    this.popup = window.open(
      AUTHORIZATION_URL,
      'Login to StackExchange',
      'width=800,height=600'
    );
  };

  renderAuthenticationMessage = () => {
    if (this.props.authenticated) {
      return <span>{t('You are authenticated')}</span>;
    }

    return (
      <a href="#authenticate" onClick={this.handleAuthenticate}>
        Authenticate through StackExchange
      </a>
    );
  };

  render() {
    return (
      <Panel>
        <Sticky>
          <StyledFlex py={1}>
            <Box w={[8 / 12, 8 / 12, 6 / 12]} mx={1} flex="1">
              <ToolbarHeader>{t('Settings')}</ToolbarHeader>
            </Box>
          </StyledFlex>
        </Sticky>
        <EmptyMessage>{this.renderAuthenticationMessage()}</EmptyMessage>
      </Panel>
    );
  }
}

export default Settings;
