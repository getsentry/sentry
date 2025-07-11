import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {IconAdd, IconEdit} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
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

export default Storybook.story('Layout Components', story => {
  story('Setup', () => (
    <Fragment>
      <p>
        As part of the Alerts Create Issues (aka WorkflowEngine) project, pre-composed
        page layouts have been created to ensure maximum composability. Each layout is
        expected to be rendered where the following contexts are provided:
      </p>
      <p>
        The page title is provided by a{' '}
        <Storybook.JSXNode
          name="SentryDocumentTitle"
          props={{title: 'Automations', noSuffix: true}}
        />{' '}
        component.
      </p>
      <p>
        The page's breadcrumbs are defined by the{' '}
        <Storybook.JSXNode
          name="BreadcrumbsProvider"
          props={{crumb: {label: 'Automations', to: '/automations'}}}
        />{' '}
        component.
      </p>
      <p>
        The page's action buttons are defined by the{' '}
        <Storybook.JSXNode
          name="ActionsProvider"
          props={{actions: <Storybook.JSXNode name="Button" />}}
        />{' '}
        component.
      </p>
    </Fragment>
  ));

  story('ListLayout', () => (
    <Fragment>
      <p>
        The Monitors and Automations index pages both use the{' '}
        <Storybook.JSXNode name="ListLayout" /> component.
      </p>

      <Storybook.SizingWindow display="block">
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
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('DetailLayout', () => (
    <Fragment>
      <p>
        Detail pages for Monitors and Automations both use the{' '}
        <Storybook.JSXNode name="DetailLayout" /> component.
      </p>

      <p>
        The <Storybook.JSXNode name="DetailLayout" /> component expects{' '}
        <Storybook.JSXProperty name="children" value={undefined} /> to be{' '}
        <Storybook.JSXNode name="DetailLayout.Main" /> and{' '}
        <Storybook.JSXNode name="DetailLayout.Sidebar" /> components.
      </p>

      <Storybook.SizingWindow display="block">
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
      </Storybook.SizingWindow>
    </Fragment>
  ));
});
