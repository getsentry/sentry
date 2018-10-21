import jQuery from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {Client} from 'app/api';
import styled from 'react-emotion';

const Logout = styled.span`
  float: right;
  padding-top: 3px;
  font-size: 16px;
`;

class NarrowLayout extends React.Component {
  static propTypes = {
    showLogout: PropTypes.bool,
  };

  componentWillMount() {
    this.api = new Client();
    jQuery(document.body).addClass('narrow');
  }

  componentWillUnmount() {
    this.api.clear();
    jQuery(document.body).removeClass('narrow');
  }

  handleLogout = () => {
    this.api.request('/auth/', {
      method: 'DELETE',
      success: () => {
        window.location = '/auth/login';
      },
    });
  };

  render() {
    return (
      <div className="app">
        <div className="pattern-bg" />
        <div className="container">
          <div className="box box-modal">
            <div className="box-header">
              <a href="/">
                <span className="icon-sentry-logo" />
              </a>
              {this.props.showLogout && (
                <a className="logout" onClick={this.handleLogout}>
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

export default NarrowLayout;
