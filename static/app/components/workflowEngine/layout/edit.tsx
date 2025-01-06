import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';

export interface WorkflowEngineEditLayoutProps {
  /**
   * The main content for this page
   */
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
  /**
   * Action buttons to display in the page header
   */
  actions?: React.ReactNode;

  /**
   * The main page title, for example "Automations" or "Rules"
   */
  title?: string;
}

/**
 * Precomposed full-width layout for Automations / Rules edit pages.
 * The `children` are expected to include `<EditLayout.Chart>` and `<EditLayout.Panel>` components.
 */
function EditLayout({parent, children, actions, title}: WorkflowEngineEditLayoutProps) {
  return (
    <Fragment>
      <SentryDocumentTitle title={title} />
      <Layout.Page>
        <StyledHeader>
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
        </StyledHeader>
        <Body>{children}</Body>
      </Layout.Page>
    </Fragment>
  );
}

const StyledHeader = styled(Layout.Header)`
  background: ${p => p.theme.background};
`;

const Body = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const ChartContainer = styled('div')`
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.background};
  gap: ${space(3)};
  width: 100%;
  flex-grow: 1;
  padding: ${space(1)} ${space(4)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const PanelsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(3)} ${space(4)};
  gap: ${space(2)};
  width: 100%;
  flex-grow: 1;
`;

function Chart({children}) {
  return <ChartContainer>{children}</ChartContainer>;
}

function Panels({children}) {
  return <PanelsContainer>{children}</PanelsContainer>;
}

const WorkflowEngineEditLayout = Object.assign(EditLayout, {Chart, Panels});

export default WorkflowEngineEditLayout;
