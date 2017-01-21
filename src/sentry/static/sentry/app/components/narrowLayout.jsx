import jQuery from 'jquery';
import React from 'react';

import Footer from '../components/footer';

const NarryLayout = React.createClass({
  componentWillMount() {
    jQuery(document.body).addClass('narrow');
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass('narrow');
  },

  render() {
    return (
      <div className="app">
        <div className="pattern-bg"/>
        <div className="container">
          <div className="box box-modal">
            <div className="box-header">
              <a href="/">
                <span className="icon-sentry-logo" />
              </a>
            </div>
            <div className="box-content with-padding">
              {this.props.children}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
});

export default NarryLayout;
