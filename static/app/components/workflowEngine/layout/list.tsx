import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';

interface WorkflowEngineListLayoutProps {
  actions: React.ReactNode;
  /** The main content for this page */
  children: React.ReactNode;
  description: string;
  docsUrl: string;
  title: string;
}

/**
 * Precomposed full-width layout for Automations / Monitors index pages.
 * The `children` are rendered as the main body content.
 */
function WorkflowEngineListLayout({
  children,
  actions,
  title,
  description,
  docsUrl,
}: WorkflowEngineListLayoutProps) {
  return (
    <Layout.Page>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>
            {title}
            <PageHeadingQuestionTooltip docsUrl={docsUrl} title={description} />
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>{actions}</Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main width="full">
          <Flex direction="column" gap="lg">
            {children}
          </Flex>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

export default WorkflowEngineListLayout;
