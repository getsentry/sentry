import {useCallback, useMemo} from 'react';

import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {IssueTypeConfig} from 'sentry/utils/issueTypeConfig/types';
import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface UseContentNavigationShortcutsProps {
  issueTypeConfig: IssueTypeConfig;
  project: Project;
}

/**
 * Content navigation shortcuts use 't' as a sequence initializer
 * This ensures that 't' cannot be used as a single-key shortcut
 * and prioritizes sequence handling for navigation
 */

export function useContentNavigationShortcuts({
  project,
  issueTypeConfig,
}: UseContentNavigationShortcutsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();

  // Only register shortcuts when on issue details pages
  const isOnIssueDetailsPage =
    location.pathname.includes('/issues/') &&
    (location.pathname.includes('/events/') || location.pathname.endsWith('/'));
  const shouldRegisterShortcuts = isOnIssueDetailsPage;

  const navigateToTab = useCallback(
    (tab: Tab) => {
      // Use the same navigation pattern as the dropdown menu
      // Don't include event ID for tab navigation - go to the tab at the issue level
      const issueBaseUrl = baseUrl.replace(/\/events\/[^/]+\//, '/');
      const tabPath = TabPaths[tab];
      navigate({
        ...location,
        pathname: `${issueBaseUrl}${tabPath}`,
        hash: undefined,
      });
    },
    [baseUrl, location, navigate]
  );

  const shortcuts = useMemo(() => {
    const availableShortcuts = [];

    // Check for replay support (same logic as header tabs)
    const organizationFeatures = new Set(organization?.features || []);
    const hasReplaySupport =
      organizationFeatures.has('session-replay') &&
      projectCanLinkToReplay(organization, project);

    // Always include details navigation
    availableShortcuts.push({
      id: 'navigate-details',
      key: 't e',
      description: `View ${issueTypeConfig.customCopy.eventUnits.toLowerCase()} in this issue`,
      handler: () => navigateToTab(Tab.DETAILS),
    });

    // Add replays if both config enabled AND has replay support
    if (issueTypeConfig.pages.replays.enabled && hasReplaySupport) {
      availableShortcuts.push({
        id: 'navigate-replays',
        key: 't y',
        description: `View ${t('replays').toLowerCase()} in this issue`,
        handler: () => navigateToTab(Tab.REPLAYS),
      });
    }

    // Add attachments if enabled
    if (issueTypeConfig.pages.attachments.enabled) {
      availableShortcuts.push({
        id: 'navigate-attachments',
        key: 't a',
        description: `View ${t('attachments').toLowerCase()} in this issue`,
        handler: () => navigateToTab(Tab.ATTACHMENTS),
      });
    }

    // Add user feedback if enabled
    if (issueTypeConfig.pages.userFeedback.enabled) {
      availableShortcuts.push({
        id: 'navigate-feedback',
        key: 't f',
        description: `View ${t('feedback').toLowerCase()} in this issue`,
        handler: () => navigateToTab(Tab.USER_FEEDBACK),
      });
    }

    return availableShortcuts;
  }, [issueTypeConfig, navigateToTab, organization, project]);

  useComponentShortcuts(
    'issue-details-tab-navigation',
    shouldRegisterShortcuts ? shortcuts : []
  );
}
