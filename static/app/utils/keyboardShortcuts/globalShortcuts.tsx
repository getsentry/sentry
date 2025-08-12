import * as React from 'react';

import {navigateTo} from 'sentry/actionCreators/navigation';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {Shortcut} from './types';
import {useShortcuts} from './shortcutsProvider';

/**
 * Initialize global keyboard shortcuts
 * These shortcuts are available throughout the application
 */
export function initializeGlobalShortcuts(router: InjectedRouter): Shortcut[] {
  const getOrgSlug = () => {
    // Try router params first
    if (router.params.orgId) return router.params.orgId;
    // Try location state
    if (router.location?.state?.orgId) return router.location.state.orgId;
    // Try to extract from pathname
    const match = router.location?.pathname?.match(/\/organizations\/([^\/]+)/);
    if (match) return match[1];
    return null;
  };

  const organizationSlug = getOrgSlug();

  const navigationShortcuts: Shortcut[] = [
    {
      id: 'global-help',
      key: 'shift+/',
      description: 'Show keyboard shortcuts',
      category: 'global',
      handler: () => {
        // This is overridden in GlobalShortcuts component
      },
    },
    {
      id: 'go-to-issues',
      key: 'g i',
      description: 'Go to Issues',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/issues/`));
        }
      },
    },
    {
      id: 'go-to-projects',
      key: 'g p',
      description: 'Go to Projects',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/projects/`));
        }
      },
    },
    {
      id: 'go-to-dashboards',
      key: 'g d',
      description: 'Go to Dashboards',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/dashboards/`));
        }
      },
    },
    {
      id: 'go-to-releases',
      key: 'g r',
      description: 'Go to Releases',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/releases/`));
        }
      },
    },
    {
      id: 'go-to-alerts',
      key: 'g a',
      description: 'Go to Alerts',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/alerts/`));
        }
      },
    },
    {
      id: 'go-to-performance',
      key: 'g e',
      description: 'Go to Performance',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/performance/`));
        }
      },
    },
    {
      id: 'go-to-replays',
      key: 'g v',
      description: 'Go to Replays',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/replays/`));
        }
      },
    },
    {
      id: 'go-to-monitors',
      key: 'g m',
      description: 'Go to Monitors',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/monitors/`));
        }
      },
    },
    {
      id: 'go-to-teams',
      key: 'g t',
      description: 'Go to Teams',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/settings/${organizationSlug}/teams/`));
        }
      },
    },
    {
      id: 'go-to-organization',
      key: 'g o',
      description: 'Go to Organization Home',
      category: 'navigation',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/`));
        }
      },
    },
  ];

  return navigationShortcuts;
}

/**
 * Component that registers global shortcuts
 * This should be rendered at the app root level
 */
export function GlobalShortcuts({router}: {router: InjectedRouter}) {
  const {openHelpModal, registerContext} = useShortcuts();
  const routerRef = React.useRef(router);

  // Update router ref when it changes
  React.useEffect(() => {
    routerRef.current = router;
  }, [router]);

  React.useEffect(() => {
    // Override the help shortcut to use our modal
    const shortcuts = initializeGlobalShortcuts(routerRef.current).map(shortcut => {
      if (shortcut.id === 'global-help') {
        return {
          ...shortcut,
          handler: () => openHelpModal(),
        };
      }
      return shortcut;
    });

    console.log('[GlobalShortcuts] Registering global shortcuts:', shortcuts);
    // Register global shortcuts using the context system
    registerContext('global', shortcuts);

    // No cleanup needed since global shortcuts persist
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty to prevent re-registration

  return null;
}
