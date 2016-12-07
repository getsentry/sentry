/*eslint getsentry/jsx-needs-il8n:0*/
import DocumentTitle from 'react-document-title';
import React from 'react';
import styled from 'styled-components';
import {Link} from 'react-router';

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
          <div className="container">
            <div className="content">
              <Heading>Styleguide</Heading>
              <div className="row">
                <div className="col-md-2">
                  <h6 className="nav-header">Sections</h6>
                  <ul className="nav nav-stacked">
                    <li><Link to="/styleguide/" activeClassName="active">Components</Link></li>
                    <li><Link to="/styleguide/type" activeClassName="active">Typography</Link></li>
                    <li><Link to="/styleguide/type" activeClassName="active">Colors</Link></li>
                    <li><Link to="/styleguide/icons" activeClassName="active">Icons</Link></li>
                  </ul>
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

const Heading = styled.h2`
  border-bottom: 1px solid #e2dee6;
  padding: 30px 0;
  margin: 0 0 40px;
`;

export default Styleguide;
