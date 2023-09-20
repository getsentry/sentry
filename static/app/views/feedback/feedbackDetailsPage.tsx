import {RouteComponentProps} from 'react-router';

import {Alert} from 'sentry/components/alert';
import useFetchFeedbackItem from 'sentry/components/feedback/useFetchFeedbackItem';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

interface RouteParams {
  feedbackSlug: string;
}
interface Props extends RouteComponentProps<RouteParams, {}, any, {}> {}

export default function FeedbackDetailsPage({params: {feedbackSlug}}: Props) {
  const organization = useOrganization();

  const [projectSlug, feedbackId] = feedbackSlug.split(':');
  const project = useProjectFromSlug({organization, projectSlug});

  const {isLoading, isError, data} = useFetchFeedbackItem(
    {feedbackId, organization, project: project!},
    {enabled: Boolean(project)}
  );

  return (
    <SentryDocumentTitle
      title={t(`Feedback v2`)}
      orgSlug={organization.slug}
      projectSlug={projectSlug}
    >
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Feedback v2')}
            <PageHeadingQuestionTooltip
              title={t(
                'Feedback submitted by users who experienced an error while using your application, including their name, email address, and any additional comments.'
              )}
              docsUrl="https://docs.sentry.io/product/user-feedback/"
            />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            {isLoading ? (
              <Placeholder />
            ) : isError ? (
              <Alert type="error" showIcon>
                {t('An error occurred')}
              </Alert>
            ) : (
              <pre>{JSON.stringify(data, null, '\t')}</pre>
            )}
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
