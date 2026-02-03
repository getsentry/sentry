import {Flex} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import useOrganization from 'sentry/utils/useOrganization';

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
  const organization = useOrganization();

  return (
    <Layout.Page>
      <NoProjectMessage organization={organization}>
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
      </NoProjectMessage>
    </Layout.Page>
  );
}

export default WorkflowEngineListLayout;
