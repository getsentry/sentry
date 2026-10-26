import {useEffect} from 'react';

import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  EXPLORE_AGENTS_SUB_PATH,
  CONVERSATIONS_DETAIL_SUB_PATH,
} from 'sentry/views/explore/conversations/settings';

/**
 * Redirects the legacy `/explore/conversations/*` paths to their `/explore/agents/`
 * equivalents. The landing view moved to `/explore/agents/` and conversation
 * details moved under `/explore/agents/conversations/:conversationId/`. The query
 * string and hash are carried over so deep links keep their time range and state.
 */
export default function ConversationsRedirect() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {conversationId} = useParams<{conversationId?: string}>();

  const pathname = normalizeUrl(
    conversationId
      ? `/organizations/${organization.slug}/explore/${EXPLORE_AGENTS_SUB_PATH}/${CONVERSATIONS_DETAIL_SUB_PATH}/${encodeURIComponent(conversationId)}/`
      : `/organizations/${organization.slug}/explore/${EXPLORE_AGENTS_SUB_PATH}/`
  );

  useEffect(() => {
    navigate({pathname, search: location.search, hash: location.hash}, {replace: true});
  }, [navigate, pathname, location.search, location.hash]);

  return null;
}
