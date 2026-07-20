import {Fragment, useRef} from 'react';
import {Outlet} from 'react-router-dom';
import type {Location} from 'history';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import Feature from 'sentry/components/acl/feature';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {type Crumb, Breadcrumbs} from 'sentry/components/breadcrumbs';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {NoAccess} from 'sentry/components/noAccess';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {isUUID} from 'sentry/utils/string/isUUID';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  CONVERSATIONS_LANDING_SUB_PATH,
  CONVERSATIONS_LANDING_TITLE,
  CONVERSATIONS_SIDEBAR_LABEL,
  MAX_PICKABLE_DAYS,
} from 'sentry/views/explore/conversations/settings';
import {hasGenAiConversationsRedesignFeature} from 'sentry/views/explore/conversations/utils/features';
import {getConversationsListQueryFromState} from 'sentry/views/explore/conversations/utils/listNavigation';
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
  const organization = useOrganization();
  const location = useLocation();
  const {conversationId} = useParams<{conversationId?: string}>();

  const isDetailPage = !!conversationId;
  // The redesigned detail page renders its own breadcrumbs (with the project
  // badge and copy affordance) into the title slot, so the layout only owns
  // the breadcrumbs for the landing and legacy detail pages.
  const isRedesign = hasGenAiConversationsRedesignFeature(organization);
  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`
  );

  // The list location we navigated from is passed via router state so the
  // breadcrumb can return to the exact filtered list (mirroring browser
  // "back"). Cache it per-conversation so a later in-page navigation that
  // drops the state (e.g. selecting a span) doesn't lose it.
  const restoredListQuery = useRestoredListQuery(conversationId, location.state);

  const backToListCrumb = restoredListQuery
    ? {
        pathname: conversationsBaseUrl,
        query: {...restoredListQuery, referrer: 'conversations-breadcrumb'},
      }
    : {
        pathname: conversationsBaseUrl,
        query: {
          statsPeriod: '24h',
          start: undefined,
          end: undefined,
          referrer: 'conversations-breadcrumb',
        },
      };

  return (
    <Fragment>
      <TopBar.Slot name="title">
        {isDetailPage && isRedesign ? null : isDetailPage ? (
          <Breadcrumbs
            crumbs={[
              {
                label: CONVERSATIONS_SIDEBAR_LABEL,
                to: backToListCrumb,
                // When we have the originating list query it already holds the
                // full filter state; preserving page filters would merge the
                // detail page's conversation-scoped start/end on top of it.
                preservePageFilters: !restoredListQuery,
              },
              {
                label: isUUID(conversationId) ? (
                  conversationId.slice(0, 8)
                ) : (
                  <Tooltip title={conversationId}>
                    <span>{conversationId}</span>
                  </Tooltip>
                ),
              },
            ]}
          />
        ) : (
          <ConversationsLandingTitle />
        )}
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton>{null}</FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}

/**
 * Returns the originating list querystring for the current conversation, read
 * from router location state. Caches it per-conversation so an in-page
 * navigation that clears the state (e.g. nuqs `replace` when selecting a span)
 * keeps the breadcrumb pointing back at the filtered list.
 */
function useRestoredListQuery(
  conversationId: string | undefined,
  state: Location['state']
): Location['query'] | undefined {
  const cache = useRef<{conversationId?: string; query?: Location['query']}>({});
  const listQueryFromState = getConversationsListQueryFromState(state);

  // Fresh state always wins, so re-opening the same conversation with new
  // filters refreshes the cache. When the state is absent (an in-page nuqs
  // `replace`), keep the cached query as long as we're on the same
  // conversation; otherwise fall back to the default.
  if (listQueryFromState) {
    cache.current = {conversationId, query: listQueryFromState};
  }

  return cache.current.conversationId === conversationId
    ? cache.current.query
    : undefined;
}

function ConversationsLandingTitle() {
  const organization = useOrganization();
  const location = useLocation();
  const savedQueryTitle = decodeScalar(location.query.title);
  const savedQueryId = decodeScalar(location.query.id);

  if (defined(savedQueryId) && defined(savedQueryTitle) && savedQueryTitle.length > 0) {
    const conversationsBaseUrl = normalizeUrl(
      `/organizations/${organization.slug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/`
    );
    const crumbs: Crumb[] = [
      {
        label: CONVERSATIONS_SIDEBAR_LABEL,
        to: {
          pathname: conversationsBaseUrl,
          query: {statsPeriod: '24h'},
        },
      },
      {
        label: savedQueryTitle,
      },
    ];
    return <Breadcrumbs crumbs={crumbs} />;
  }

  return (
    <Fragment>
      {CONVERSATIONS_LANDING_TITLE} <FeatureBadge type="beta" />
    </Fragment>
  );
}

export default ConversationsLayout;
