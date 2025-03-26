import type {FeatureFlagOnboardingSurface} from 'sentry/components/events/featureFlags/useFeatureFlagOnboarding';

export type FeatureFlagEventParameters = {
  'flags.cta_dismissed': {type: string};
  'flags.event_and_suspect_flags_found': {
    numEventFlags: number;
    numSuspectFlags: number;
    numTotalFlags: number;
  };
  'flags.logs-paginated': {
    direction: 'next' | 'prev';
    surface: 'settings' | 'flag_drawer';
  };
  'flags.setup_sidebar_opened': {
    surface: 'issue_details.flags_section' | 'issue_details.flags_drawer';
  };
  'flags.sort_flags': {sortMethod: string};
  'flags.table_rendered': {
    numFlags: number;
    orgSlug: string;
    projectSlug: string;
  };
  'flags.view-all-clicked': Record<string, unknown>;
  'flags.view-setup-sidebar': {
    surface: FeatureFlagOnboardingSurface;
  };
};

export type FeatureFlagEventKey = keyof FeatureFlagEventParameters;

export const featureFlagEventMap: Record<FeatureFlagEventKey, string | null> = {
  'flags.view-all-clicked': 'Clicked View All Flags',
  'flags.sort_flags': 'Sorted Flags',
  'flags.event_and_suspect_flags_found': 'Number of Event and Suspect Flags',
  'flags.table_rendered': 'Flag Table Rendered',
  'flags.cta_dismissed': 'Flag CTA Dismissed',
  'flags.logs-paginated': 'Feature Flag Logs Paginated',
  'flags.view-setup-sidebar': 'Viewed Feature Flag Onboarding Sidebar',
  'flags.setup_sidebar_opened': 'Feature Flag Setup Sidebar Opened',
};
