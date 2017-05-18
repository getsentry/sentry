import React from 'react';
import jsxToString from 'jsx-to-string';
import styled from 'styled-components';
import SyntaxHighlighter from 'react-syntax-highlighter';
import {docco} from 'react-syntax-highlighter/dist/styles';

import Button from '../../components/button';
import {NavHeader, NavStacked, NavItem} from '../../components/navigation';
import Pills from '../../components/pills';
import Pill from '../../components/pill';

const StyleguideComponents = React.createClass({
  render() {
    return (
      <div>
        <Section>
          <h2>Button</h2>
          <p>Sometimes you just need to click it.</p>
          <Hr />
          <Row>
            <Column>
              <Button kind="primary" size="lg" to="/sup">Click it</Button> <br /><br />
              <Button
                onClick={() => {
                  alert('hiya');
                }}>
                Click it
              </Button> <br /><br />
              <Button
                kind="danger"
                size="sm"
                onClick={() => {
                  alert('💥');
                }}>
                Click it
              </Button> <br /><br />
              <Button size="xs" href="http://example.com">Click it</Button> <br /><br />
              <Button
                disabled
                size="xs"
                onClick={() => {
                  alert('💥');
                }}>
                Don't click it!
              </Button>
            </Column>
            <Column>
              <SyntaxHighlighter style={docco}>
                {jsxToString(
                  <Button kind="primary" size="lg" to="/sup">Click it</Button>,
                  {
                    displayName: 'Button'
                  }
                )}
              </SyntaxHighlighter>
              <SyntaxHighlighter style={docco}>
                {jsxToString(<Button href="http://example.com">Click it</Button>, {
                  displayName: 'Button'
                })}
              </SyntaxHighlighter>
            </Column>
          </Row>
        </Section>

        <Section>
          <h2>Pills</h2>
          <p>When you have key/value data but are tight on space.</p>
          <Hr />
          <Row>
            <Column>
              <Pills>
                <Pill name="key" value="value" />
                <Pill name="good" value={true}>thing</Pill>
                <Pill name="bad" value={false}>thing</Pill>
                <Pill name="generic">thing</Pill>
              </Pills>
            </Column>
            <Column>
              <SyntaxHighlighter style={docco}>
                {jsxToString(<Pill name="good" value={true}>Truthy/Good</Pill>, {
                  displayName: 'Pill'
                })}
              </SyntaxHighlighter>
              <SyntaxHighlighter style={docco}>
                {jsxToString(<Pill name="bad" value={false}>Falsey/Bad</Pill>, {
                  displayName: 'Pill'
                })}
              </SyntaxHighlighter>
            </Column>
          </Row>
        </Section>

        <Section>
          <h2>NavStacked</h2>
          <p>Sidebar-based navigation</p>
          <Hr />
          <Row>
            <Column>
              <NavHeader>Organization</NavHeader>
              <NavStacked>
                <NavItem to="/styleguide/">Dashboard</NavItem>
                <NavItem to="/org/projects-and-teams">Projects & Teams</NavItem>
                <NavItem to="/org/stats">Stats</NavItem>
              </NavStacked>
            </Column>
            <Column>
              <SyntaxHighlighter style={docco}>
                {jsxToString(<NavStacked>...</NavStacked>, {
                  displayName: 'NavStacked'
                })}
              </SyntaxHighlighter>
              <SyntaxHighlighter style={docco}>
                {jsxToString(<NavItem to="/org">Dashboard</NavItem>, {
                  displayName: 'NavItem'
                })}
              </SyntaxHighlighter>
            </Column>
          </Row>
        </Section>
      </div>
    );
  }
});

// Styleguide Styles

const Hr = styled.hr`
  border-top-color: ${props => props.theme.borderColorLight};
  margin: 24px -40px 30px;
  opacity: .6;
`;

const Section = styled.div`
  background: #fff;
  border-radius: 7px;
  box-shadow: 0 15px 50px rgba(0,0,0, .05), 0 4px 10px rgba(0,0,0, .05);
  margin: 0 0 40px;
  padding: 30px 40px;
`;

const Row = styled.div`
  display: flex;
  margin-left: -15px;
  margin-right: -15px;
`;

const Column = styled.div`
  margin-left: 15px;
  margin-right: 15px;
  width: 50%;
`;

export default StyleguideComponents;
