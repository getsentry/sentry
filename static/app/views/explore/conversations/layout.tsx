import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {NoAccess} from 'sentry/components/noAccess';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  CONVERSATIONS_LANDING_SUB_PATH,
  CONVERSATIONS_LANDING_TITLE,
  CONVERSATIONS_SIDEBAR_LABEL,
  MAX_PICKABLE_DAYS,
} from 'sentry/views/explore/conversations/settings';
import {TopBar} from 'sentry/views/navigation/topBar';

function ConversationsLayout() {
  const organization = useOrganization();

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <Feature
        features="gen-ai-conversations"
        organization={organization}
        renderDisabled={NoAccess}
      >
        <ConversationsLayoutContent />
      </Feature>
    </Feature>
  );
}

function ConversationsLayoutContent() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={CONVERSATIONS_LANDING_TITLE} orgSlug={organization.slug}>
      <AnalyticsArea name="explore.conversations">
        <Stack flex={1}>
          <ConversationsHeader />
          <NoProjectMessage organization={organization}>
            <PageFiltersContainer
              maxPickableDays={MAX_PICKABLE_DAYS}
              storageNamespace="conversations"
            >
              <Outlet />
            </PageFiltersContainer>
          </NoProjectMessage>
        </Stack>
      </AnalyticsArea>
    </SentryDocumentTitle>
  );
}

function ConversationsHeader() {
  const organization = useOrganization();
  const {conversationId} = useParams<{conversationId?: string}>();

  const isDetailPage = !!conversationId;
  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`
  );

  return (
    <Fragment>
      <TopBar.Slot name="title">
        {isDetailPage ? (
          <Breadcrumbs
            crumbs={[
              {
                label: CONVERSATIONS_SIDEBAR_LABEL,
                to: conversationsBaseUrl,
                preservePageFilters: true,
              },
              {label: conversationId.slice(0, 8)},
            ]}
          />
        ) : (
          <Fragment>
            {CONVERSATIONS_LANDING_TITLE} <FeatureBadge type="alpha" />
          </Fragment>
        )}
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton>{null}</FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}

export default ConversationsLayout;
