import {withTheme} from 'emotion-theming';
import PropTypes from 'prop-types';
import React from 'react';
import jQuery from 'jquery';
import styled, {cx} from 'react-emotion';

import {t} from '../locale';

class NarrowLayout extends React.Component {
  static propTypes = {
    showSignOut: PropTypes.bool,
  };

  componentWillMount() {
    jQuery(document.body).addClass('narrow');
  }

  componentWillUnmount() {
    jQuery(document.body).removeClass('narrow');
  }

  render() {
    let {theme, showSignOut} = this.props;

    return (
      <div className="app">
        <div className="pattern-bg" />
        <div className="container">
          <div className="box box-modal">
            <Header>
              <LogoLink>
                <a href="/">
                  <span className="icon-sentry-logo" />
                </a>
              </LogoLink>
              <div>
                {showSignOut && (
                  <a style={{color: theme.blue, fontSize: '1em'}} href="/auth/logout/">
                    {t('Sign out')}
                  </a>
                )}
              </div>
            </Header>
            <div className="box-content with-padding">{this.props.children}</div>
          </div>
        </div>
      </div>
    );
  }
}

export default withTheme(NarrowLayout);

const Header = styled(({className, ...props}) => (
  <div {...props} className={cx('box-header', className)} />
))`
  display: flex;
  align-items: center;
`;

const LogoLink = styled('div')`
  flex: 1;
`;
