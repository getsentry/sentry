import {createContext, useCallback, useContext, useMemo, type ReactNode} from 'react';

import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useGroupId} from './groupIdContext';

interface IssueDetailsBasePath {
  basePath: string;
  groupId: string;
}

const IssueDetailsBasePathContext = createContext<IssueDetailsBasePath | null>(null);

interface IssueDetailsBasePathProviderProps {
  /**
   * The path the issue is rendered under, with a trailing slash. The host must also
   * route `${basePath}events/:eventId/`.
   */
  basePath: string;
  children: ReactNode;
  groupId: string;
}

/**
 * Lets pages other than issue details (such as the inbox) render issue details under
 * their own path. Only applies to `groupId`, so issue details nested inside for other
 * groups still point to the issue details page.
 */
export function IssueDetailsBasePathProvider({
  basePath,
  children,
  groupId,
}: IssueDetailsBasePathProviderProps) {
  const value = useMemo(() => ({basePath, groupId}), [basePath, groupId]);
  return (
    <IssueDetailsBasePathContext value={value}>{children}</IssueDetailsBasePathContext>
  );
}

/**
 * Returns a function that builds a path to the current issue, or to one of its events,
 * wherever issue details is rendered. Use it to move between events without leaving
 * the current page.
 *
 * Links to issue tabs (activity, distributions, etc.) should use
 * `useGroupDetailsRoute().baseUrl` instead, which always points to the issue details page.
 */
export function useIssueDetailsPath(): (eventId?: string) => string {
  const organization = useOrganization();
  const groupId = useGroupId();
  const context = useContext(IssueDetailsBasePathContext);

  const basePath =
    context?.groupId === groupId
      ? context.basePath
      : normalizeUrl(`/organizations/${organization.slug}/issues/${groupId}/`);

  return useCallback(
    (eventId?: string) => (eventId ? `${basePath}events/${eventId}/` : basePath),
    [basePath]
  );
}
