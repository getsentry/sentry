import jQuery from 'jquery';
import React from 'react';

import Footer from '../components/footer';
import Header from '../components/header';

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
        <Header />
        <div className="container">
          <div className="box">
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

