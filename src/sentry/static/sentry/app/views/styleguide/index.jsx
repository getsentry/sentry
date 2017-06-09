/*eslint getsentry/jsx-needs-il8n:0*/
import DocumentTitle from 'react-document-title';
import React from 'react';
import 'style-loader!./styleguide.less';

import {NavHeader, NavItem} from '../../components/navigation';

const Styleguide = React.createClass({
  componentWillMount() {
    jQuery(document.body).addClass('styleguide');
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass('styleguide');
  },

  getTitle() {
    return 'Sentry Styleguide';
  },

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <div className="styleguide-wrapper">
            <div className="styleguide-header">
              <div className="styleguide-container">
                <span className="styleguide-logo">
                  <span className="icon-sentry-logo" />
                </span>
                {' '}
                Styleguide
              </div>
            </div>
            <div className="styleguide-container">
              <div className="row">
                <div className="col-md-2">
                  <NavHeader>Sections</NavHeader>
                  <NavItem to="/styleguide/">Components</NavItem>
                  <NavItem to="/styleguide/type">Typography</NavItem>
                  <NavItem to="/styleguide/colors">Colors</NavItem>
                  <NavItem to="/styleguide/icons">Icons</NavItem>
                </div>
                <div className="col-md-10">
                  {this.props.children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

export default Styleguide;
