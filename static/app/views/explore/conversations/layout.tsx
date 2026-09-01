import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {NoAccess} from 'sentry/components/noAccess';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  EXPLORE_AGENTS_SUB_PATH,
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
  const {conversationId} = useParams<{conversationId?: string}>();
  const isDetailPage = !!conversationId;

  return (
    <SentryDocumentTitle title={CONVERSATIONS_LANDING_TITLE} orgSlug={organization.slug}>
      <AnalyticsArea name="explore.conversations">
        <Stack flex={1}>
          <ConversationsHeader />
          <NoProjectMessage organization={organization}>
            <PageFiltersContainer
              maxPickableDays={MAX_PICKABLE_DAYS}
              skipLoadLastUsed={isDetailPage}
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
  const {conversationId} = useParams<{conversationId?: string}>();
  const isDetailPage = !!conversationId;

  // The detail page renders its own breadcrumbs (with the project badge and
  // copy affordance) into the TopBar slots, so the layout only owns the title
  // for the landing page.
  return (
    <Fragment>
      {isDetailPage ? null : <ConversationsLandingHeader />}
      <TopBar.Slot name="feedback">
        <FeedbackButton>{null}</FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}

function ConversationsLandingHeader() {
  const organization = useOrganization();
  const location = useLocation();
  const savedQueryTitle = decodeScalar(location.query.title);
  const savedQueryId = decodeScalar(location.query.id);
  const hasSavedQuery =
    defined(savedQueryId) && defined(savedQueryTitle) && savedQueryTitle.length > 0;

  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${EXPLORE_AGENTS_SUB_PATH}/`
  );

  if (!hasSavedQuery) {
    return <TopBar.Slot name="title">{CONVERSATIONS_LANDING_TITLE}</TopBar.Slot>;
  }

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: CONVERSATIONS_SIDEBAR_LABEL,
              to: {pathname: conversationsBaseUrl, query: {statsPeriod: '24h'}},
            },
          ]}
        />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title item={{type: 'page-title', label: savedQueryTitle}} />
      </TopBar.Slot>
    </Fragment>
  );
}

export default ConversationsLayout;
