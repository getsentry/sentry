import React from 'react';
import styled from '@emotion/styled';
import {withInfo} from '@storybook/addon-info';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Breadcrumbs from 'app/components/breadcrumbs';
import Link from 'app/components/links/link';
import * as Layout from 'app/components/layouts/thirds';
import space from 'app/styles/space';

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

export default {
  title: 'Layouts/Thirds',
};

export const _6633Layout = withInfo('Two column layout with header & sidebar')(() => (
  <Container>
    <Layout.Header>
      <Layout.HeaderContent>
        <Layout.Title>Some heading content</Layout.Title>
      </Layout.HeaderContent>
    </Layout.Header>
    <Layout.Body>
      <Layout.Main>
        <h1>Content Region</h1>
        <p>Some text here</p>
      </Layout.Main>
      <Layout.Side>
        <h3>Sidebar content</h3>
      </Layout.Side>
    </Layout.Body>
  </Container>
));

_6633Layout.story = {
  name: '66/33 layout',
};

export const _6633WithHeaderControls = withInfo('Two column layout with header actions')(
  () => (
    <Container>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs crumbs={crumbs} />
          <Layout.Title>Some heading content</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <Button>Save</Button>
            <Button>Delete</Button>
            <Button>Update</Button>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main>
          <h1>Content Region</h1>
          <p>Some text here</p>
        </Layout.Main>
        <Layout.Side>
          <h3>Sidebar content</h3>
        </Layout.Side>
      </Layout.Body>
    </Container>
  )
);

_6633WithHeaderControls.story = {
  name: '66/33 with header controls',
};

export const _6633WithManyHeaderControls = withInfo(
  'Two column layout with header controls'
)(() => (
  <Container>
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs crumbs={crumbs} />
        <Layout.Title>Heading text</Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <MarginedButtonBar gap={1}>
          <Button size="small">Save</Button>
          <Button size="small">Update</Button>
        </MarginedButtonBar>
        <ButtonBar gap={1}>
          <Button size="small">rollup</Button>
          <Button size="small">modify</Button>
          <Button size="small">create</Button>
          <Button size="small">update</Button>
          <Button size="small">delete</Button>
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
    <Layout.Body>
      <Layout.Main>
        <h1>Content Region</h1>
        <p>Some text here</p>
      </Layout.Main>
      <Layout.Side>
        <h3>Sidebar content</h3>
      </Layout.Side>
    </Layout.Body>
  </Container>
));

_6633WithManyHeaderControls.story = {
  name: '66/33 with many header controls',
};

export const SingleColumnMode = withInfo('Single column mode so we can hide the sidebar')(
  () => (
    <Container>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs crumbs={crumbs} />
          <Layout.Title>Some heading content</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <Button size="small">clicker</Button>
            <Button size="small">clicker</Button>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <h1>Content Region</h1>
          <p>
            Some text here, that goes on and on. It should strecth the full width of the
            container, and have no space on the right.
          </p>
        </Layout.Main>
      </Layout.Body>
    </Container>
  )
);

SingleColumnMode.story = {
  name: 'single column mode',
};

export const _6633WithTabNavigation = withInfo('Two column layout with tab navigation')(
  () => (
    <Container>
      <BorderlessHeader>
        <Layout.HeaderContent>
          <StyledLayoutTitle>Alerts</StyledLayoutTitle>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <Button size="small">clicker</Button>
            <Button size="small">clicker</Button>
          </ButtonBar>
        </Layout.HeaderActions>
      </BorderlessHeader>
      <TabLayoutHeader>
        <Layout.HeaderNavTabs underlined>
          <li className="active">
            <Link to="#">Active</Link>
          </li>
          <li>
            <Link to="#">Inactive</Link>
          </li>
        </Layout.HeaderNavTabs>
      </TabLayoutHeader>
      <Layout.Body>
        <Layout.Main>
          <h1>Content Region</h1>
          <p>Some text here</p>
        </Layout.Main>
        <Layout.Side>
          <h3>Sidebar content</h3>
        </Layout.Side>
      </Layout.Body>
    </Container>
  )
);

_6633WithTabNavigation.story = {
  name: '66/33 with tab based nav',
};

const Container = styled('div')`
  background: ${p => p.theme.gray200};
  margin: ${space(2)};
  border: 1px solid ${p => p.theme.border};
`;

const MarginedButtonBar = styled(ButtonBar)`
  margin-bottom: ${space(1)};
`;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;

const BorderlessHeader = styled(Layout.Header)`
  border-bottom: 0;
`;

const TabLayoutHeader = styled(Layout.Header)`
  padding-top: 0;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    padding-top: 0;
  }
`;
