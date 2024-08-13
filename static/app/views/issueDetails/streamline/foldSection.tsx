import {type CSSProperties, forwardRef, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import type {SectionConfig} from 'sentry/views/issueDetails/streamline/eventDetails';

const LOCAL_STORAGE_PREFIX = 'issue-details-fold-section-collapse:';

interface FoldSectionProps {
  children: React.ReactNode;
  config: SectionConfig;
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
    config,
    initialCollapse = false,
    preventCollapse = false,
    ...props
  },
  ref
) {
  const organization = useOrganization();
  const {key: sectionKey, isBlank} = config;
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

  if (isBlank?.() ?? false) {
    return null;
  }

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
