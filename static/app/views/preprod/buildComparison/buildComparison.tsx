import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useParams} from 'sentry/utils/useParams';

export default function BuildComparison() {
  const params = useParams<{
    baseArtifactId: string | null;
    headArtifactId: string | null;
    projectId: string;
  }>();
  const headArtifactId = params.headArtifactId;
  const baseArtifactId = params.baseArtifactId;
  const projectId = params.projectId;

  return (
    <SentryDocumentTitle title="Build comparison">
      <Layout.Page>
        <Layout.Header>Build comparison header</Layout.Header>

        <Layout.Body>
          <Layout.Main>
            Build comparison main content head: {headArtifactId} base: {baseArtifactId}{' '}
            project: {projectId}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
