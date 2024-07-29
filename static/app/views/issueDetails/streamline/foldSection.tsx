import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

const LOCAL_STORAGE_PREFIX = 'fold-section-collapse-';
export const enum FoldSectionKey {
  // Suspect Commits & Traces
  USER_FEEDBACK = 'issue-details-user-feedback', // In development
  LLM_MONITORING = 'issue-details-llm-monitoring',

  UPTIME = 'issue-details-uptime', // Only Uptime issues
  CRON = 'issue-details-cron-timeline', // Only Cron issues

  HIGHLIGHTS = 'issue-details-highlights',
  RESOURCES = 'issue-details-resources', // Position controlled by flag

  EVIDENCE = 'issue-details-evidence',
  MESSAGE = 'issue-details-message',
  STACK_TRACE = 'issue-details-stack-trace',

  THREADS = 'issue-details-threads',
  THREAD_STATE = 'issue-details-thread-state',
  THREAD_TAGS = 'issue-details-thread-tags',

  // QuickTraceQuery -> todo

  SPAN_EVIDENCE = 'issue-details-span-evidence',
  HYDRATION_DIFF = 'issue-details-hydration-diff',
  REPLAY = 'issue-details-replay',

  HPKP = 'issue-details-hpkp',
  CSP = 'issue-details-csp',
  EXPECTCT = 'issue-details-expectct',
  TEMPLATE = 'issue-details-template',

  BREADCRUMBS = 'issue-details-breadcrumbs',
  DEBUGMETA = 'issue-details-debugmeta',
  REQUEST = 'issue-details-request',

  TAGS = 'issue-details-tags',
  SCREENSHOT = 'issue-details-screenshot',

  CONTEXTS = 'issue-details-contexts',
  EXTRA = 'issue-details-extra',
  PACKAGE = 'issue-details-package',
  DEVICE = 'issue-details-device',
  VIEW_HIERARCHY = 'issue-details-view-hierarchy',
  ATTACHMENTS = 'issue-details-attachments',
  SDK = 'issue-details-sdk',
  GROUPING_INFO = 'issue-details-grouping-info',
  RRWEB = 'issue-details-rrweb',
}

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
  /**
   * Should this section be initially open, gets overridden by user preferences
   */
  initialCollapse?: boolean;
  /**
   * Disable the ability for the user to collapse the section
   */
  preventCollapse?: boolean;
}

export function FoldSection({
  children,
  title,
  actions,
  sectionKey,
  initialCollapse = false,
  preventCollapse = false,
  ...props
}: FoldSectionProps) {
  const organization = useOrganization();
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    `${LOCAL_STORAGE_PREFIX}${sectionKey}`,
    initialCollapse
  );
  const [isLayerEnabled, setIsLayerEnabled] = useState(true);

  const toggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent browser summary/details behaviour
      setIsCollapsed(collapsed => {
        trackAnalytics('issue_details.section_fold', {
          sectionKey,
          organization,
          open: !collapsed,
        });
        return !collapsed;
      });
    },
    [setIsCollapsed, organization, sectionKey]
  );

  return (
    <section {...props}>
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
    </section>
  );
}

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
