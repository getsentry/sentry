import type {SdkProviderEnum} from 'sentry/components/events/featureFlags/utils';
import type {PlatformKey} from 'sentry/types/project';

export type FeatureFlagEventParameters = {
  'flags.cta_dismissed': {surface: string; type: string};
  'flags.cta_rendered': {area: string};
  'flags.drawer_details_rendered': {
    numLogs: number;
  };
  'flags.drawer_rendered': {
    numFlags: number;
  };
  'flags.event_and_suspect_flags_found': {
    numEventFlags: number;
    numSuspectFlags: number;
    numTotalFlags: number;
  };
  'flags.logs-paginated': {
    direction: 'next' | 'prev';
    surface: string;
  };
  'flags.setup_sidebar_selection': {
    platform?: string;
    provider?: SdkProviderEnum;
  };
  'flags.sort_flags': {sortMethod: string};
  'flags.table_rendered': {
    numFlags: number;
    orgSlug: string;
    projectSlug: string;
  };
  'flags.view-all-clicked': Record<string, unknown>;
  'flags.view-setup-sidebar': {
    surface: string;
    platform?: PlatformKey;
  };
};

export type FeatureFlagEventKey = keyof FeatureFlagEventParameters;

export const featureFlagEventMap: Record<FeatureFlagEventKey, string | null> = {
  'flags.cta_dismissed': 'Flag CTA Dismissed',
  'flags.cta_rendered': 'Flag CTA Viewed',
  'flags.drawer_details_rendered': 'Viewed Feature Flag Drawer Details',
  'flags.drawer_rendered': 'Viewed Feature Flag Drawer',
  'flags.event_and_suspect_flags_found': 'Number of Event and Suspect Flags',
  'flags.logs-paginated': 'Feature Flag Logs Paginated',
  'flags.setup_sidebar_selection':
    'Selected Provider or Project in Feature Flag Onboarding Sidebar',
  'flags.sort_flags': 'Sorted Flags',
  'flags.table_rendered': 'Flag Table Rendered',
  'flags.view-all-clicked': 'Clicked View All Flags',
  'flags.view-setup-sidebar': 'Viewed Feature Flag Onboarding Sidebar',
};
