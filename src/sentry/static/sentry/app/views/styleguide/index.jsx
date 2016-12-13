/*eslint getsentry/jsx-needs-il8n:0*/
import DocumentTitle from 'react-document-title';
import React from 'react';
import styled from 'styled-components';

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
            <div className="content">
              <Header>
                <Container>
                  <Logo><span className="icon-sentry-logo" /></Logo> Styleguide
                </Container>
              </Header>
              <Container>
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
              </Container>
            </div>
          </div>
      </DocumentTitle>
    );
  }
});

const Container = styled.div`
  max-width: 1024px;
  margin: 0 auto;
  padding: 0 15px;
`;

const Header = styled.div`
  background: #fbfbfc;
  color: #161319;
  border-bottom: 1px solid #e2dee6;
  padding: 12px 0;
  margin: 0 0 40px;
  font-size: 19px;
  line-height: 1;
`;

const Logo = styled.span`
  color: #625471;
  opacity: .75;
  font-size: 20px;
  margin-right: 4px;
  line-height: 1;
  position: relative;
  top: 2px;
`;

export default Styleguide;
