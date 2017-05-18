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
          <Wrapper>
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
          </Wrapper>
        </div>
      </DocumentTitle>
    );
  }
});

const Wrapper = styled.div`
  padding-bottom: 40px;
`;

const Container = styled.div`
  max-width: 1024px;
  margin: 0 auto;
`;

const Header = styled.div`
  color: #161319;
  padding: 50px 0;
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
