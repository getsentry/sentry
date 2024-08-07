import {type CSSProperties, forwardRef, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import type {EventDetailsContextType} from 'sentry/views/issueDetails/streamline/eventDetails';

const LOCAL_STORAGE_PREFIX = 'issue-details-fold-section-collapse:';

export const enum FoldSectionKey {
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

  // QuickTraceQuery?

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
  RRWEB = 'rrweb', // Legacy integration prior to replays
}

export const DEFAULT_SECTION_DATA: EventDetailsContextType['sectionData'] = {
  [FoldSectionKey.TRACE]: {isOpen: true},
  [FoldSectionKey.USER_FEEDBACK]: {isOpen: true},
  [FoldSectionKey.LLM_MONITORING]: {isOpen: true},
  [FoldSectionKey.UPTIME]: {isOpen: true},
  [FoldSectionKey.CRON]: {isOpen: true},
  [FoldSectionKey.HIGHLIGHTS]: {isOpen: true},
  [FoldSectionKey.RESOURCES]: {isOpen: true},
  [FoldSectionKey.EXCEPTION]: {isOpen: true},
  [FoldSectionKey.STACKTRACE]: {isOpen: true},
  [FoldSectionKey.SPANS]: {isOpen: true},
  [FoldSectionKey.EVIDENCE]: {isOpen: true},
  [FoldSectionKey.MESSAGE]: {isOpen: true},
  [FoldSectionKey.SPAN_EVIDENCE]: {isOpen: true},
  [FoldSectionKey.HYDRATION_DIFF]: {isOpen: true},
  [FoldSectionKey.REPLAY]: {isOpen: true},
  [FoldSectionKey.HPKP]: {isOpen: true},
  [FoldSectionKey.CSP]: {isOpen: true},
  [FoldSectionKey.EXPECTCT]: {isOpen: true},
  [FoldSectionKey.EXPECTSTAPLE]: {isOpen: true},
  [FoldSectionKey.TEMPLATE]: {isOpen: true},
  [FoldSectionKey.BREADCRUMBS]: {isOpen: true},
  [FoldSectionKey.DEBUGMETA]: {isOpen: true},
  [FoldSectionKey.REQUEST]: {isOpen: true},
  [FoldSectionKey.TAGS]: {isOpen: true},
  [FoldSectionKey.SCREENSHOT]: {isOpen: true},
  [FoldSectionKey.CONTEXTS]: {isOpen: true},
  [FoldSectionKey.EXTRA]: {isOpen: true},
  [FoldSectionKey.PACKAGES]: {isOpen: false},
  [FoldSectionKey.DEVICE]: {isOpen: true},
  [FoldSectionKey.VIEW_HIERARCHY]: {isOpen: true},
  [FoldSectionKey.ATTACHMENTS]: {isOpen: true},
  [FoldSectionKey.SDK]: {isOpen: false},
  [FoldSectionKey.GROUPING_INFO]: {isOpen: false},
  [FoldSectionKey.RRWEB]: {isOpen: true},
};

interface FoldSectionProps {
  children: React.ReactNode;
  /**
   * Unique key to persist user preferences for initalizing the section to open/closed
   */
  sectionKey: FoldSectionKey;
  /**
   * Title of the section, always visible
   */
  title: React.ReactNode;
  /**
   * Actions associated with the section, only visible when open
   */
  actions?: React.ReactNode;
  className?: string;
  /**
   * Should this section be initially open, gets overridden by user preferences
   */
  initialCollapse?: boolean;
  /**
   * Disable the ability for the user to collapse the section
   */
  preventCollapse?: boolean;
  style?: CSSProperties;
}

export const FoldSection = forwardRef<HTMLElement, FoldSectionProps>(function FoldSection(
  {
    children,
    title,
    actions,
    sectionKey,
    initialCollapse = false,
    preventCollapse = false,
    ...props
  },
  ref
) {
  const organization = useOrganization();
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    `${LOCAL_STORAGE_PREFIX}${sectionKey}`,
    initialCollapse
  );
  // This controls disabling the InteractionStateLayer when hovering over action items. We don't
  // want selecting an action to appear as though it'll fold/unfold the section.
  const [isLayerEnabled, setIsLayerEnabled] = useState(true);

  const toggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent browser summary/details behaviour
      trackAnalytics('issue_details.section_fold', {
        sectionKey,
        organization,
        open: !isCollapsed,
      });
      setIsCollapsed(collapsed => !collapsed);
    },
    [setIsCollapsed, organization, sectionKey, isCollapsed]
  );

  return (
    <Section {...props} ref={ref} id={sectionKey}>
      <details open={!isCollapsed || preventCollapse}>
        <Summary
          preventCollapse={preventCollapse}
          onClick={preventCollapse ? e => e.preventDefault() : toggleCollapse}
        >
          <InteractionStateLayer
            hidden={preventCollapse ? preventCollapse : !isLayerEnabled}
          />
          <TitleWithActions>
            {title}
            {!preventCollapse && !isCollapsed && (
              <div
                onClick={e => e.stopPropagation()}
                onMouseEnter={() => setIsLayerEnabled(false)}
                onMouseLeave={() => setIsLayerEnabled(true)}
              >
                {actions}
              </div>
            )}
          </TitleWithActions>
          <IconWrapper preventCollapse={preventCollapse}>
            <IconChevron direction={isCollapsed ? 'down' : 'up'} size="xs" />
          </IconWrapper>
        </Summary>
        <ErrorBoundary mini>
          <Content>{children}</Content>
        </ErrorBoundary>
      </details>
    </Section>
  );
});

export const Section = styled('section')``;

const Content = styled('div')`
  padding: ${space(0.5)} ${space(0.75)};
`;

const Summary = styled('summary')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: ${space(0.5)} ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: ${p => (p.preventCollapse ? 'initial' : 'pointer')};
  position: relative;
  overflow: hidden;
  &::marker,
  &::-webkit-details-marker {
    display: none;
  }
`;

const IconWrapper = styled('div')<{preventCollapse: boolean}>`
  color: ${p => p.theme.subText};
  line-height: 0;
  visibility: ${p => (p.preventCollapse ? 'hidden' : 'initial')};
`;

const TitleWithActions = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  margin-right: 8px;
  align-items: center;
  /* Usually the actions are buttons, this height allows actions appearing after opening the
  details section to not expand the summary */
  min-height: 26px;
`;
