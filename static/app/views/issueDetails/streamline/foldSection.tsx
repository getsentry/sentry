import {useCallback} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

const LOCAL_STORAGE_PREFIX = 'fold-section-collapse-';
export const enum FoldSectionKey {
  // Suspect Commits & Traces
  USER_FEEDBACK = 'issue-details-user-feedback', // In development
  LLM_MONITORING = 'issue-details-llm-monitoring',

  UPTIME = 'issue-details-uptime', // Only Uptime issues
  CRON = 'issue-details-cron-timeline', // Only Cron issues

  HIGHLIGHTS = 'issue-details-highlights',
  RESOURCES = 'issue-details-resources', // Position controlled by flag

  // -> Keep going from here

  STACK_TRACE = 'issue-details-stack-trace',
  BREADCRUMBS = 'issue-details-breadcrumbs',
  TAGS = 'issue-details-tags',
  CONTEXTS = 'issue-details-contexts',
}

interface FoldSectionProps {
  children: React.ReactNode;
  sectionKey: FoldSectionKey;
  title: React.ReactNode;
  initialCollapse?: boolean;
  preventCollapse?: boolean;
}

export function FoldSection({
  children,
  title,
  sectionKey,
  initialCollapse = false,
  preventCollapse = false,
  ...props
}: FoldSectionProps) {
  const [isCollapsed, setIsCollapsed] = useLocalStorageState(
    `${LOCAL_STORAGE_PREFIX}${sectionKey}`,
    initialCollapse
  );

  const toggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent browser summary/details behaviour
      setIsCollapsed(collapsed => !collapsed);
    },
    [setIsCollapsed]
  );

  return (
    <section {...props}>
      <Details open={!isCollapsed || preventCollapse}>
        <Summary
          preventCollapse={preventCollapse}
          onClick={preventCollapse ? e => e.preventDefault() : toggleCollapse}
        >
          <InteractionStateLayer hidden={preventCollapse} />
          <div>{title}</div>
          <IconWrapper preventCollapse={preventCollapse}>
            <IconChevron direction={isCollapsed ? 'up' : 'down'} size="xs" />
          </IconWrapper>
        </Summary>
        <ErrorBoundary mini>{children}</ErrorBoundary>
      </Details>
    </section>
  );
}

const Details = styled('details')`
  margin: ${space(1)} ${space(0.75)};
`;

const Summary = styled('summary')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: ${p => (p.preventCollapse ? 'initial' : 'pointer')};
  position: relative;
`;

const IconWrapper = styled('div')<{preventCollapse: boolean}>`
  color: ${p => p.theme.subText};
  line-height: 0;
  visibility: ${p => (p.preventCollapse ? 'hidden' : 'initial')};
`;
