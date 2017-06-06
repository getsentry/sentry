import React from 'react';
import jsxToString from 'jsx-to-string';
import SyntaxHighlighter from 'react-syntax-highlighter';
import {docco} from 'react-syntax-highlighter/dist/styles';

import 'style-loader!./styleguide.less';

import Button from '../../components/buttons/button';
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
              <Button priority="primary" size="lg" to="/sup">Click it</Button>
              {' '}
              <br />
              <br />
              <Button
                onClick={() => {
                  alert('hiya');
                }}>
                Click it
              </Button> <br /><br />
              <Button
                priority="danger"
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
                  <Button priority="primary" size="lg" to="/sup">Click it</Button>,
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

const Hr = function() {
  return <hr className="styleguide-hr" />;
};

const Section = function(props) {
  return <div className="styleguide-section">{props.children}</div>;
};

const Row = function(props) {
  return <div className="styleguide-row">{props.children}</div>;
};

const Column = function(props) {
  return <div className="styleguide-column">{props.children}</div>;
};

export default StyleguideComponents;
