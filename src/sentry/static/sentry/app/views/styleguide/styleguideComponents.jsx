import React from 'react';
import jsxToString from 'jsx-to-string';
import SyntaxHighlighter from 'react-syntax-highlighter';
import {docco} from 'react-syntax-highlighter/dist/styles';

import 'style-loader!./styleguide.less';

import {NavHeader, NavStacked, NavItem} from '../../components/navigation';
import Pills from '../../components/pills';
import Pill from '../../components/pill';

import buttonExamples from '../../components/buttons/button/__examples';

const Example = function(props) {
  return (
    <Row>
      <Column>{props.children}</Column>
      <Column>
        <SyntaxHighlighter style={docco}>
          {jsxToString(props.children)}
        </SyntaxHighlighter>
      </Column>
    </Row>
  );
};

const StyleguideComponents = React.createClass({
  render() {
    return (
      <div>
        <Section>
          <h2>Button</h2>
          <p>Sometimes you just need to click it.</p>
          <Hr />

          {buttonExamples.map(ex => Example({children: ex}))}
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
