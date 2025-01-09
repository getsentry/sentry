import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {IconAdd, IconEdit} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

interface LayoutProps {
  action?: React.ReactNode;
  breadcrumb?: string;
  children?: React.ReactNode;
  title?: string;
}

function withProviders(Layout: any) {
  return function ({action, breadcrumb, title, children}: LayoutProps) {
    return (
      <SentryDocumentTitle title={title} noSuffix>
        <BreadcrumbsProvider crumb={{label: breadcrumb, to: '#breadcrumb'}}>
          <ActionsProvider actions={action}>
            <Layout>{children}</Layout>
          </ActionsProvider>
        </BreadcrumbsProvider>
      </SentryDocumentTitle>
    );
  };
}

const List = withProviders(ListLayout);
const Detail = withProviders(DetailLayout);
const Edit = withProviders(EditLayout);

const Container = styled(Flex)`
  background: ${p => p.theme.background};
`;

const Placeholder = styled('div')`
  margin: ${space(2)} 0;
  flex: 1;
  background: ${p => p.theme.translucentSurface100};
  border: 1px solid ${p => p.theme.translucentBorder};
  color: ${p => p.theme.textColor};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)} ${space(4)};
  font-size: ${p => p.theme.codeFontSize};
  font-weight: normal;
  font-family: ${p => p.theme.text.familyMono};
`;

export default storyBook('Layout Components', story => {
  story('Setup', () => (
    <Fragment>
      <p>
        As part of the Alerts Create Issues (aka WorkflowEngine) project, pre-composed
        page layouts have been created to ensure maximum composability. Each layout is
        expected to be rendered where the following contexts are provided:
      </p>
      <p>
        The page title is provided by a{' '}
        <JSXNode
          name="SentryDocumentTitle"
          props={{title: 'Automations', noSuffix: true}}
        />{' '}
        component.
      </p>
      <p>
        The page's breadcrumbs are defined by the{' '}
        <JSXNode
          name="BreadcrumbsProvider"
          props={{crumb: {label: 'Automations', to: '/automations'}}}
        />{' '}
        component.
      </p>
      <p>
        The page's action buttons are defined by the{' '}
        <JSXNode name="ActionsProvider" props={{actions: <JSXNode name="Button" />}} />{' '}
        component.
      </p>
    </Fragment>
  ));

  story('ListLayout', () => (
    <Fragment>
      <p>
        The Monitors and Automations index pages both use the{' '}
        <JSXNode name="ListLayout" /> component.
      </p>

      <SizingWindow display="block">
        <Container>
          <List
            title="Automations"
            action={
              <Button icon={<IconAdd isCircled />} priority="primary">
                Create Automation
              </Button>
            }
          >
            <Placeholder>children</Placeholder>
          </List>
        </Container>
      </SizingWindow>
    </Fragment>
  ));

  story('DetailLayout', () => (
    <Fragment>
      <p>
        Detail pages for Monitors and Automations both use the{' '}
        <JSXNode name="DetailLayout" /> component.
      </p>

      <p>
        The <JSXNode name="DetailLayout" /> component expects{' '}
        <JSXProperty name="children" value={undefined} /> to be{' '}
        <JSXNode name="DetailLayout.Main" /> and <JSXNode name="DetailLayout.Sidebar" />{' '}
        components.
      </p>

      <SizingWindow display="block">
        <Container>
          <Detail
            title="Notify Slack team"
            breadcrumb="Automations"
            action={
              <Button icon={<IconEdit />} priority="primary">
                Edit
              </Button>
            }
          >
            <DetailLayout.Main>
              <Placeholder>main</Placeholder>
            </DetailLayout.Main>
            <DetailLayout.Sidebar>
              <Placeholder>sidebar</Placeholder>
            </DetailLayout.Sidebar>
          </Detail>
        </Container>
      </SizingWindow>
    </Fragment>
  ));

  story('EditLayout', () => (
    <Fragment>
      <p>
        Configuration pages for Monitors and Automations both use the{' '}
        <JSXNode name="EditLayout" /> component.
      </p>

      <p>
        The <JSXNode name="EditLayout" /> component expects{' '}
        <JSXProperty name="children" value={undefined} /> to be{' '}
        <JSXNode name="EditLayout.Chart" /> and <JSXNode name="EditLayout.Panels" />{' '}
        components.
      </p>

      <SizingWindow display="block">
        <Container>
          <Edit
            title="Notify Slack team"
            breadcrumb="Automations"
            action={<Button priority="primary">Save</Button>}
          >
            <EditLayout.Chart>
              <Placeholder>chart</Placeholder>
            </EditLayout.Chart>
            <EditLayout.Panels>
              <Placeholder>panels</Placeholder>
              <Placeholder>panels</Placeholder>
              <Placeholder>panels</Placeholder>
            </EditLayout.Panels>
          </Edit>
        </Container>
      </SizingWindow>
    </Fragment>
  ));
});
