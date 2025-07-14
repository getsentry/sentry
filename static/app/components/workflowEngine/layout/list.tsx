import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';

interface WorkflowEngineListLayoutProps {
  actions: React.ReactNode;
  /** The main content for this page */
  children: React.ReactNode;
}

/**
 * Precomposed full-width layout for Automations / Monitors index pages.
 * The `children` are rendered as the main body content.
 */
function WorkflowEngineListLayout({children, actions}: WorkflowEngineListLayoutProps) {
  const title = useDocumentTitle();
  return (
    <Layout.Page>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>{title}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>{actions}</Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <Flex direction="column" gap={space(1.5)}>
            {children}
          </Flex>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

export default WorkflowEngineListLayout;
