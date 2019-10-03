import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {logout} from 'app/actionCreators/account';
import {Client} from 'app/api';
import styled from 'react-emotion';

class NarrowLayout extends React.Component {
  static propTypes = {
    showLogout: PropTypes.bool,
    maxWidth: PropTypes.string,
  };

  componentWillMount() {
    this.api = new Client();
    document.body.classList.add('narrow');
  }

  componentWillUnmount() {
    this.api.clear();
    document.body.classList.remove('narrow');
  }

  handleLogout = () => {
    logout(this.api).then(() => (window.location = '/auth/login'));
  };

  render() {
    return (
      <div className="app">
        <div className="pattern-bg" />
        <div className="container" style={{maxWidth: this.props.maxWidth}}>
          <div className="box box-modal">
            <div className="box-header">
              <a href="/">
                <span className="icon-sentry-logo" />
              </a>
              {this.props.showLogout && (
                <a className="logout pull-right" onClick={this.handleLogout}>
                  <Logout>{t('Sign out')}</Logout>
                </a>
              )}
            </div>
            <div className="box-content with-padding">{this.props.children}</div>
          </div>
        </div>
      </div>
    );
  }
}

const Logout = styled('span')`
  font-size: 16px;
`;

export default NarrowLayout;
