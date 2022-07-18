import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import space from 'sentry/styles/space';

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
  title: 'Views/Layout - Thirds',
};

export const _6633Layout = () => (
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
);

_6633Layout.storyName = '66/33';
_6633Layout.parameters = {
  docs: {
    description: {
      story: 'Two column layout with header & sidebar',
    },
  },
};

export const _6633WithHeaderControls = () => (
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
);

_6633WithHeaderControls.storyName = '66/33 - With Header Controls';
_6633WithHeaderControls.parameters = {
  docs: {
    description: {
      story: 'Two column layout with header actions',
    },
  },
};

export const _6633WithManyHeaderControls = () => (
  <Container>
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs crumbs={crumbs} />
        <Layout.Title>Heading text</Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <MarginedButtonBar gap={1}>
          <Button size="sm">Save</Button>
          <Button size="sm">Update</Button>
        </MarginedButtonBar>
        <ButtonBar gap={1}>
          <Button size="sm">rollup</Button>
          <Button size="sm">modify</Button>
          <Button size="sm">create</Button>
          <Button size="sm">update</Button>
          <Button size="sm">delete</Button>
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
);

_6633WithManyHeaderControls.storyName = '66/33 - With Many Header Controls';
_6633WithManyHeaderControls.parameters = {
  docs: {
    description: {
      story: 'Two column layout with header controls',
    },
  },
};

export const SingleColumnMode = () => (
  <Container>
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs crumbs={crumbs} />
        <Layout.Title>Some heading content</Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <Button size="sm">clicker</Button>
          <Button size="sm">clicker</Button>
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
);

SingleColumnMode.storyName = 'Single Column Mode';
SingleColumnMode.parameters = {
  docs: {
    description: {
      story: 'Single column mode so we can hide the sidebar',
    },
  },
};

export const _6633WithTabNavigation = () => (
  <Container>
    <BorderlessHeader>
      <Layout.HeaderContent>
        <StyledLayoutTitle>Alerts</StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <Button size="sm">clicker</Button>
          <Button size="sm">clicker</Button>
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
);

_6633WithTabNavigation.storyName = '66/33 - With Tab-based Nav';
_6633WithTabNavigation.parameters = {
  docs: {
    description: {
      story: 'Two column layout with tab navigation',
    },
  },
};

const Container = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
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

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding-top: 0;
  }
`;
