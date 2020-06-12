import React from 'react';
import styled from '@emotion/styled';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Breadcrumbs from 'app/components/breadcrumbs';
import * as Layout from 'app/components/layouts/thirds';

const crumbs = [
  {
    label: 'Issues',
    to: '',
  },
  {
    label: 'List',
    to: '',
  },
  {
    label: 'Detail',
    to: '',
  },
];

storiesOf('Layouts|Thirds', module)
  .add(
    '2/3rd column',
    withInfo('Two column layout with header & sidebar')(() => (
      <Container>
        <Layout.Header>
          <Heading>Some heading content</Heading>
        </Layout.Header>
        <Layout.ContentBox>
          <Layout.Main>
            <h1>Content Region</h1>
            <p>Some text here</p>
          </Layout.Main>
          <Layout.Side>
            <h3>Sidebar content</h3>
          </Layout.Side>
        </Layout.ContentBox>
      </Container>
    ))
  )
  .add(
    '66/33 layout with header controls',
    withInfo('Two column layout with header controls')(() => (
      <Container>
        <Layout.Header>
          <Breadcrumbs crumbs={crumbs} />
          <Heading>Some heading content</Heading>
          <Layout.HeaderTopControls>
            <Button>Top button</Button>
          </Layout.HeaderTopControls>
          <Layout.HeaderBottomControls>
            <ButtonBar gap={1}>
              <Button size="small">clicker</Button>
              <Button size="small">clicker</Button>
            </ButtonBar>
          </Layout.HeaderBottomControls>
        </Layout.Header>
        <Layout.ContentBox>
          <Layout.Main>
            <h1>Content Region</h1>
            <p>Some text here</p>
          </Layout.Main>
          <Layout.Side>
            <h3>Sidebar content</h3>
          </Layout.Side>
        </Layout.ContentBox>
      </Container>
    ))
  );

const Container = styled('div')`
  background: #fbfbfc;
  margin: 16px;
  border: 1px solid ${p => p.theme.gray400};
`;

const Heading = styled('h2')`
  margin: 0;
`;
