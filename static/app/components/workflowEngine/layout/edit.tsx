import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {ActionsFromContext} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsFromContext} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import {space} from 'sentry/styles/space';

export interface WorkflowEngineEditLayoutProps {
  /**
   * The main content for this page
   * Expected to include `<EditLayout.Chart>` and `<EditLayout.Panel>` components.
   */
  children: React.ReactNode;
}

/**
 * Precomposed full-width layout for Automations / Monitors edit pages.
 */
function EditLayout({children}: WorkflowEngineEditLayoutProps) {
  const title = useDocumentTitle();
  return (
    <Layout.Page>
      <StyledHeader>
        <Layout.HeaderContent>
          <BreadcrumbsFromContext />
          <Layout.Title>{title}</Layout.Title>
        </Layout.HeaderContent>
        <ActionsFromContext />
      </StyledHeader>
      <Body>{children}</Body>
    </Layout.Page>
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
