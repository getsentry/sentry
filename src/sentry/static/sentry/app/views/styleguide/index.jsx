import React from 'react';
import jsxToString from 'jsx-to-string';
import styled from 'styled-components';
import SyntaxHighlighter from 'react-syntax-highlighter';
import {docco} from 'react-syntax-highlighter/dist/styles';

import Pills from '../../components/pills';
import Pill from '../../components/pill';

/*
<Pills>
  <Pill name="id" value={data.id} />
  <Pill name="name" value={data.name} />
  <Pill name="was active" value={data.current} />
  <Pill name="crashed" value={!data.crashed}>{data.crashed ? 'yes' : 'no'}</Pill>
</Pills>
*/

export default function Styleguide() {
  return (
    <div>
      <h1>Styleguide</h1>

      <Section>
        <Row>
          <Column>
            <h2>Button</h2>
            <p>When you just need to click it.</p>
            <a href="#" className="btn btn-primary">Primary</a>{' '}
            <a href="#" className="btn btn-default">Default</a>
          </Column>
          <Column>
            <SyntaxHighlighter style={docco}>
              {jsxToString(
                <div>
                  <a href="#" className="btn btn-primary">Primary</a>
                  <a href="#" className="btn btn-default">Default</a>
                </div>
                ,
                {
                    displayName: 'div'
                }
              )}
            </SyntaxHighlighter>
          </Column>
        </Row>
      </Section>

      <Section>
        <Row>
          <Column>
            <h2>Pills</h2>
            <p>When you have key/value data but are tight on space.</p>
            <Pills>
              <Pill name="key" value="value" />
              <Pill name="good" value={true}>thing</Pill>
              <Pill name="bad" value={false}>thing</Pill>
              <Pill name="generic">thing</Pill>
            </Pills>
          </Column>
          <Column>
            <SyntaxHighlighter style={docco}>
              {jsxToString(
                <Pills>
                  <Pill name="key" value="value" />
                  <Pill name="good" value={true}>thing</Pill>
                  <Pill name="bad" value={false}>thing</Pill>
                  <Pill name="generic">thing</Pill>
                </Pills>
                ,
                {
                    displayName: 'Pills'
                }
              )}
            </SyntaxHighlighter>
          </Column>
        </Row>
      </Section>
    </div>
  );
}

const Section = styled.div`
  border-top: 1px solid #e2dee6;
  padding: 30px 0;
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
