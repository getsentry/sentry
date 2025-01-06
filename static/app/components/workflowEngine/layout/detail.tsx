import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import {Flex} from 'sentry/components/container/flex';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';

export interface WorkflowEngineDetailLayoutProps {
  /** The main content for this page */
  children: React.ReactNode;
  /**
   * Breadcrumb info for the parent page
   */
  parent: {
    /**
     * Link to the parent page, displayed as a breadcrumb
     */
    href: LocationDescriptor;
    /**
     * Title of the parent page, displayed as a breadcrumb
     */
    title: React.ReactNode;
  };

  /** Action buttons to display in the page header */
  actions?: React.ReactNode;

  /**
   * The main page title, for example "Automations" or "Rules"
   */
  title?: string;
}

/**
 * Precomposed 67/33 layout for Automations / Rules detail pages.
 * The `children` are expected to include `<DetailLayout.Main>` and `<DetailLayout.Sidebar>` components.
 */
function DetailLayout({
  children,
  parent,
  actions,
  title,
}: WorkflowEngineDetailLayoutProps) {
  return (
    <Fragment>
      <SentryDocumentTitle title={title} />
      <StyledPage>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: parent.title,
                  to: parent.href,
                },
                {
                  label: title,
                },
              ]}
            />
            <Layout.Title>{title}</Layout.Title>
          </Layout.HeaderContent>
          {actions ? (
            <Layout.HeaderActions>
              <ButtonBar merged={false} gap={1}>
                {actions}
              </ButtonBar>
            </Layout.HeaderActions>
          ) : null}
        </Layout.Header>
        <StyledBody>{children}</StyledBody>
      </StyledPage>
    </Fragment>
  );
}

const StyledPage = styled(Layout.Page)`
  background: ${p => p.theme.background};
`;

const StyledBody = styled(Layout.Body)`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

interface RequiredChildren {
  children: React.ReactNode;
}
function Main({children}: RequiredChildren) {
  return (
    <Layout.Main>
      <Flex column gap={space(2)}>
        {children}
      </Flex>
    </Layout.Main>
  );
}
function Sidebar({children}: RequiredChildren) {
  return (
    <Layout.Side>
      <Flex column gap={space(2)}>
        {children}
      </Flex>
    </Layout.Side>
  );
}

const WorkflowEngineDetailLayout = Object.assign(DetailLayout, {Main, Sidebar});

export default WorkflowEngineDetailLayout;
