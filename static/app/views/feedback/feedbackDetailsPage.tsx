import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import FeedbackActivityItem from 'sentry/components/feedback/feedbackActivityItem';
import FeedbackComments from 'sentry/components/feedback/feedbackComments';
import FeedbackHeader from 'sentry/components/feedback/feedbackHeader';
import FeedbackTags from 'sentry/components/feedback/feedbackTags';
import FeedbackViewers from 'sentry/components/feedback/feedbackViewers';
import useFetchFeedbackItem from 'sentry/components/feedback/useFetchFeedbackItem';
import * as Layout from 'sentry/components/layouts/thirds';
import ObjectInspector from 'sentry/components/objectInspector';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackDetailsPage() {
  const organization = useOrganization();

  const {isLoading, isError, data} = useFetchFeedbackItem({}, {});

  return (
    <SentryDocumentTitle title={`Feedback v2 — ${organization.slug}`}>
      <Layout.Header>
        <Layout.HeaderContent>
          <FeedbackHeader organization={organization} feedback={data} />
        </Layout.HeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main>
            {isLoading ? (
              <Placeholder />
            ) : isError ? (
              <Alert type="error" showIcon>
                {t('An error occurred')}
              </Alert>
            ) : (
              <Fragment>
                <FeedbackDataSection
                  title="Feedback"
                  type="feedback"
                  help={t('The feedback that was submitted')}
                >
                  <FeedbackActivityItem feedback={data!} />
                </FeedbackDataSection>
                <FeedbackDataSection
                  title="Comments"
                  type="comments"
                  help={t('Private comments you and your team have made')}
                >
                  <FeedbackComments />
                </FeedbackDataSection>
              </Fragment>
            )}
          </Layout.Main>
          <Layout.Side>
            {isLoading ? (
              <Placeholder />
            ) : isError ? null : (
              <Fragment>
                <FeedbackViewers />
                <FeedbackTags feedback={data!} />
                <ObjectInspector
                  data={data}
                  expandPaths={[]}
                  // onExpand={handleDimensionChange}
                  theme={{
                    TREENODE_FONT_SIZE: '0.7rem',
                    ARROW_FONT_SIZE: '0.5rem',
                  }}
                />
              </Fragment>
            )}
          </Layout.Side>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const FeedbackDataSection = styled(EventDataSection)`
  padding: 0 !important;
`;
