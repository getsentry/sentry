import {Fragment} from 'react';

import ButtonBar from 'sentry/components/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';

export interface WorkflowEngineListLayoutProps {
  /** The main content for this page */
  children: React.ReactNode;

  /** Action buttons to display in the page header */
  actions?: React.ReactNode;

  /**
   * The main page title, for example "Automations" or "Rules"
   */
  title?: string;
}

/**
 * Precomposed full-width layout for Automations / Rules index pages.
 * The `children` are rendered as the main body content.
 */
function WorkflowEngineListLayout({
  children,
  actions,
  title,
}: WorkflowEngineListLayoutProps) {
  return (
    <Fragment>
      <SentryDocumentTitle title={title} />
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
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
        <Layout.Body>
          <Layout.Main fullWidth>{children}</Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </Fragment>
  );
}

export default WorkflowEngineListLayout;
