import {Link} from '@sentry/scraps/link';

import type {Organization} from 'sentry/types/organization';

import {USER_SESSIONS_SUB_PATH} from './settings';

/** The session detail page for a given `session.id`. */
export function getSessionDetailUrl(organization: Organization, sessionId: string): string {
  return `/organizations/${organization.slug}/explore/${USER_SESSIONS_SUB_PATH}/${sessionId}/`;
}

/**
 * A `session.id` attribute value, linked to its session detail page — the reverse
 * of the session timeline's own deep links: from a span, log or metric back up to
 * the session it belongs to.
 */
export function SessionIdLink({
  organization,
  sessionId,
}: {
  organization: Organization;
  sessionId: string;
}) {
  if (!sessionId) {
    return <span>{sessionId}</span>;
  }
  return <Link to={getSessionDetailUrl(organization, sessionId)}>{sessionId}</Link>;
}
