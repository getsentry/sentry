import {createContext, type Dispatch, useContext} from 'react';

import type {EventDetailsActions} from 'sentry/views/issueDetails/streamline/useEventDetailsState';

export const enum SectionKey {
  TRACE = 'trace',

  USER_FEEDBACK = 'user-feedback',
  LLM_MONITORING = 'llm-monitoring',

  UPTIME = 'uptime', // Only Uptime issues
  CRON = 'cron-timeline', // Only Cron issues

  HIGHLIGHTS = 'highlights',
  RESOURCES = 'resources', // Position controlled by flag

  EXCEPTION = 'exception',
  STACKTRACE = 'stacktrace',
  SPANS = 'spans',
  EVIDENCE = 'evidence',
  MESSAGE = 'message',

  SPAN_EVIDENCE = 'span-evidence',
  HYDRATION_DIFF = 'hydration-diff',
  REPLAY = 'replay',

  HPKP = 'hpkp',
  CSP = 'csp',
  EXPECTCT = 'expectct',
  EXPECTSTAPLE = 'expectstaple',
  TEMPLATE = 'template',

  BREADCRUMBS = 'breadcrumbs',
  DEBUGMETA = 'debugmeta',
  REQUEST = 'request',

  TAGS = 'tags',
  SCREENSHOT = 'screenshot',

  CONTEXTS = 'contexts',
  EXTRA = 'extra',
  PACKAGES = 'packages',
  DEVICE = 'device',
  VIEW_HIERARCHY = 'view-hierarchy',
  ATTACHMENTS = 'attachments',
  SDK = 'sdk',
  GROUPING_INFO = 'grouping-info',
  PROCESSING_ERROR = 'processing-error',
  RRWEB = 'rrweb', // Legacy integration prior to replays
}

export interface SectionConfig {
  key: SectionKey;
  isBlank?: boolean;
  isOpen?: boolean;
  onOpen?: () => void;
}

export interface EventDetailsContextType {
  dispatch: Dispatch<EventDetailsActions>;
  searchQuery: string;
  sectionData: {
    [key in SectionKey]?: SectionConfig;
  };
  /**
   * Merges provided config with existing config at that section key
   */
  updateSectionData?: (key: SectionKey, config: Partial<SectionConfig>) => void;
}

export const EventDetailsContext = createContext<EventDetailsContextType>({
  searchQuery: '',
  sectionData: {},
  updateSectionData: () => {},
  dispatch: () => {},
});

export function useEventDetails() {
  return useContext(EventDetailsContext);
}
