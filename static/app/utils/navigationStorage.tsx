/**
 * Utility for tracking navigation history in localStorage
 */

import type {Location} from 'history';

const NAVIGATION_HISTORY_KEY = 'sentry-navigation-history';
const MAX_NAVIGATION_HISTORY = 100; // Limit to prevent localStorage bloat

interface NavigationEntry {
  id: string;
  path: string;
  timestamp: number;
  title: string;
  // Optional metadata for richer display
  organizationSlug?: string;
  pageType?: 'issue' | 'project' | 'organization' | 'dashboard' | 'settings' | 'other';
  projectSlug?: string;
  search?: string;
}

/**
 * Extract page information from pathname for better labeling
 */
function extractPageInfo(
  pathname: string,
  _search?: string
): {
  pageType: NavigationEntry['pageType'];
  title: string;
  organizationSlug?: string;
  projectSlug?: string;
} {
  const segments = pathname.split('/').filter(Boolean);

  // Pattern: /organizations/{slug}/...
  if (segments[0] === 'organizations' && segments[1]) {
    const organizationSlug = segments[1];

    // Issue details: /organizations/{org}/issues/{issueId}/
    if (segments[2] === 'issues' && segments[3]) {
      return {
        title: `Issue ${segments[3]}`,
        pageType: 'issue',
        organizationSlug,
      };
    }

    // Project details: /organizations/{org}/projects/{project}/
    if (segments[2] === 'projects' && segments[3]) {
      const projectSlug = segments[3];
      return {
        title: `Project ${projectSlug}`,
        pageType: 'project',
        organizationSlug,
        projectSlug,
      };
    }

    // Dashboard: /organizations/{org}/dashboards/
    if (segments[2] === 'dashboards') {
      if (segments[3]) {
        return {
          title: `Dashboard`,
          pageType: 'dashboard',
          organizationSlug,
        };
      }
      return {
        title: 'Dashboards',
        pageType: 'dashboard',
        organizationSlug,
      };
    }

    // Settings: /organizations/{org}/settings/
    if (segments[2] === 'settings') {
      return {
        title: 'Organization Settings',
        pageType: 'settings',
        organizationSlug,
      };
    }

    // Default organization page
    if (segments.length === 2) {
      return {
        title: `${organizationSlug}`,
        pageType: 'organization',
        organizationSlug,
      };
    }

    // Other organization pages
    return {
      title: `${organizationSlug} - ${segments.slice(2).join(' / ')}`,
      pageType: 'organization',
      organizationSlug,
    };
  }

  // Settings: /settings/
  if (segments[0] === 'settings') {
    return {
      title: 'Account Settings',
      pageType: 'settings',
    };
  }

  // Fallback for other routes
  const title =
    segments
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' / ') || 'Home';

  return {
    title,
    pageType: 'other',
  };
}

/**
 * Get all navigation history entries
 */
export function getNavigationHistory(): NavigationEntry[] {
  try {
    const stored = localStorage.getItem(NAVIGATION_HISTORY_KEY);
    if (!stored) {
      return [];
    }

    const allEntries: NavigationEntry[] = JSON.parse(stored);
    return allEntries.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    return [];
  }
}

/**
 * Add a navigation entry to history
 */
export function addNavigationEntry(location: Location): void {
  const stored = localStorage.getItem(NAVIGATION_HISTORY_KEY);
  const existingEntries: NavigationEntry[] = stored ? JSON.parse(stored) : [];

  const pathname = location.pathname;
  const search = location.search;
  const fullPath = pathname + (search || '');

  // Don't track duplicate consecutive entries
  const lastEntry = existingEntries[0];
  if (lastEntry && lastEntry.path === fullPath) {
    return;
  }

  const pageInfo = extractPageInfo(pathname, search);

  // Remove existing entry for this path to avoid duplicates
  const filteredEntries = existingEntries.filter(entry => entry.path !== fullPath);

  // Create new entry
  const newEntry: NavigationEntry = {
    id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    path: fullPath,
    search,
    timestamp: Date.now(),
    ...pageInfo,
  };

  // Keep only the most recent entries to prevent localStorage bloat
  const updatedEntries = [newEntry, ...filteredEntries]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_NAVIGATION_HISTORY);

  localStorage.setItem(NAVIGATION_HISTORY_KEY, JSON.stringify(updatedEntries));
}

/**
 * Get navigation history filtered by page type
 */
export function getNavigationHistoryByType(
  pageType: NavigationEntry['pageType']
): NavigationEntry[] {
  return getNavigationHistory().filter(entry => entry.pageType === pageType);
}

/**
 * Get navigation history for a specific organization
 */
export function getNavigationHistoryByOrganization(
  organizationSlug: string
): NavigationEntry[] {
  return getNavigationHistory().filter(
    entry => entry.organizationSlug === organizationSlug
  );
}

/**
 * Check if a path has been visited
 */
export function hasVisitedPath(path: string): boolean {
  const history = getNavigationHistory();
  return history.some(entry => entry.path === path);
}

/**
 * Clear all navigation history
 */
export function clearNavigationHistory(): void {
  localStorage.removeItem(NAVIGATION_HISTORY_KEY);
}

/**
 * Get recent navigation entries (last N entries)
 */
export function getRecentNavigationHistory(limit = 10): NavigationEntry[] {
  return getNavigationHistory().slice(0, limit);
}

/**
 * Hook to use navigation history functionality
 */
export function useNavigationHistory() {
  return {
    getNavigationHistory,
    getRecentNavigationHistory,
    getNavigationHistoryByType,
    getNavigationHistoryByOrganization,
    addNavigationEntry,
    hasVisitedPath,
    clearNavigationHistory,
  };
}
