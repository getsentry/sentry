import * as Layout from 'sentry/components/layouts/thirds';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {WorkflowEngineActions as Actions} from 'sentry/components/workflowEngine/layout/actions';

export interface WorkflowEngineListLayoutProps {
  /** The main content for this page */
  children: React.ReactNode;
}

/**
 * Precomposed full-width layout for Automations / Monitors index pages.
 * The `children` are rendered as the main body content.
 */
function WorkflowEngineListLayout({children}: WorkflowEngineListLayoutProps) {
  const title = useDocumentTitle();
  return (
    <Layout.Page>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{title}</Layout.Title>
        </Layout.HeaderContent>
        <Actions />
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>{children}</Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

export default WorkflowEngineListLayout;
