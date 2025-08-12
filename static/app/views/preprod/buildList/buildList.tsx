import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';

export default function BuildList() {
  return (
    <SentryDocumentTitle title="Build list">
      <Layout.Page>
        <Layout.Header>Build list header</Layout.Header>

        <Layout.Body>
          <Layout.Main>Build list main content</Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
