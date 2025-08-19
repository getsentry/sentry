import * as React from 'react';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

import {useShortcuts} from './shortcutsProvider';
import type {Shortcut} from './types';

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
      handler: () => {
        // This is overridden in GlobalShortcuts component
      },
    },
    {
      id: 'go-to-issues',
      key: 'g i',
      description: 'Go to Issues',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/issues/`));
        }
      },
    },
    {
      id: 'go-to-feedback',
      key: 'g f',
      description: 'Go to Feedback',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/issues/feedback/`)
          );
        }
      },
    },
    {
      id: 'go-to-projects',
      key: 'g p',
      description: 'Go to Projects',
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
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/dashboards/`));
        }
      },
    },
    {
      id: 'go-to-traces',
      key: 'g t',
      description: 'Go to Traces',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/explore/traces/`));
        }
      },
    },
    {
      id: 'go-to-discover',
      key: 'g v',
      description: 'Go to Discover',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/explore/discover/`)
          );
        }
      },
    },
    {
      id: 'go-to-logs',
      key: 'g l',
      description: 'Go to Logs',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/explore/logs/`));
        }
      },
    },
    {
      id: 'go-to-profiles',
      key: 'g shift+p',
      description: 'Go to Profiles',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/explore/profiling/`)
          );
        }
      },
    },
    {
      id: 'go-to-replays',
      key: 'g y',
      description: 'Go to Replays',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/explore/replays/`)
          );
        }
      },
    },
    {
      id: 'go-to-releases',
      key: 'g r',
      description: 'Go to Releases',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/explore/releases/`)
          );
        }
      },
    },
    {
      id: 'go-to-alerts',
      key: 'g e',
      description: 'Go to Alerts',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/alerts/`));
        }
      },
    },
    {
      id: 'go-to-frontend-insights',
      key: 'g n',
      description: 'Go to Frontend Insights',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/insights/frontend/`)
          );
        }
      },
    },
    {
      id: 'go-to-backend-insights',
      key: 'g b',
      description: 'Go to Backend Insights',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/insights/backend/`)
          );
        }
      },
    },
    {
      id: 'go-to-mobile-insights',
      key: 'g m',
      description: 'Go to Mobile Insights',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/insights/mobile/`)
          );
        }
      },
    },
    {
      id: 'go-to-ai-insights',
      key: 'g a',
      description: 'Go to AI Insights',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/insights/ai/`));
        }
      },
    },
    {
      id: 'go-to-crons',
      key: 'g c',
      description: 'Go to Crons',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/organizations/${organizationSlug}/insights/crons/`));
        }
      },
    },
    {
      id: 'go-to-uptime',
      key: 'g u',
      description: 'Go to Uptime',
      handler: () => {
        if (organizationSlug) {
          router.push(
            normalizeUrl(`/organizations/${organizationSlug}/insights/uptime/`)
          );
        }
      },
    },
    {
      id: 'go-to-organization-settings',
      key: 'g s',
      description: 'Go to Settings',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/settings/${organizationSlug}/`));
        }
      },
    },
    {
      id: 'go-to-organization-members',
      key: 'g shift+m',
      description: 'Go to Members',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/settings/${organizationSlug}/members/`));
        }
      },
    },
    {
      id: 'go-to-teams',
      key: 'g shift+t',
      description: 'Go to Teams',
      handler: () => {
        if (organizationSlug) {
          router.push(normalizeUrl(`/settings/${organizationSlug}/teams/`));
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
  const registeredRef = React.useRef(false);

  // Update router ref when it changes
  React.useEffect(() => {
    routerRef.current = router;
  }, [router]);

  React.useEffect(() => {
    // Only register once to prevent infinite loops
    if (registeredRef.current) {
      return;
    }

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

    // Register all shortcuts under 'global' context
    registerContext('global', shortcuts);
    registeredRef.current = true;

    // No cleanup needed since global shortcuts persist
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty to prevent re-registration

  return null;
}
