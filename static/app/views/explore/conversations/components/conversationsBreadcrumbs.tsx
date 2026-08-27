import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  EXPLORE_AGENTS_SUB_PATH,
  CONVERSATIONS_SIDEBAR_LABEL,
} from 'sentry/views/explore/conversations/settings';
import {TopBar} from 'sentry/views/navigation/topBar';

const COPY_ID_LABEL = t('Copy conversation ID');

interface ConversationsBreadcrumbsProps {
  conversationId: string;
}

/** UUIDs are shown truncated, so the full value needs a tooltip to stay readable. */
function getDisplayId(conversationId: string) {
  return isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;
}

export function ConversationsBreadcrumbs({
  conversationId,
}: ConversationsBreadcrumbsProps) {
  const organization = useOrganization();
  const location = useLocation();
  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/explore/${EXPLORE_AGENTS_SUB_PATH}/`
  );

  // Carry project/environment filters back to the landing page, then force the
  // default 24h period. BreadcrumbList link items build their own query, so this
  // replaces the legacy `preservePageFilters` flag.
  const query = {
    ...extractSelectionParameters(location.query),
    statsPeriod: '24h',
    start: undefined,
    end: undefined,
    referrer: 'conversations-breadcrumb',
  };

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: CONVERSATIONS_SIDEBAR_LABEL,
              to: {pathname: conversationsBaseUrl, query},
            },
          ]}
        />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title
          item={{
            type: 'page-title',
            label: t('Conversation %s', getDisplayId(conversationId)),
            labelTooltip: isUUID(conversationId) ? conversationId : undefined,
            trailingActions: {
              type: 'copy',
              text: conversationId,
              label: COPY_ID_LABEL,
              tooltip: COPY_ID_LABEL,
              onCopy: () =>
                trackAnalytics('conversations.detail.copy-conversation-id', {
                  organization,
                }),
            },
          }}
        />
      </TopBar.Slot>
    </Fragment>
  );
}
