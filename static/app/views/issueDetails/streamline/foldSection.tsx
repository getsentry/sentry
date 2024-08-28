import {
  type CSSProperties,
  forwardRef,
  Fragment,
  useCallback,
  useLayoutEffect,
  useState,
} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {useEventDetails} from 'sentry/views/issueDetails/streamline/context';

export function getFoldSectionKey(key: SectionKey) {
  return `'issue-details-fold-section-collapse:${key}`;
}

export interface FoldSectionProps {
  children: React.ReactNode;
  sectionKey: SectionKey;
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
  forwardedRef
) {
  const organization = useOrganization();
  const {sectionData, navScrollMargin, dispatch} = useEventDetails();
  // Does not control open/close state. Controls what state is persisted to local storage
  const [isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(sectionKey),
    initialCollapse
  );

  useLayoutEffect(() => {
    if (!sectionData.hasOwnProperty(sectionKey)) {
      dispatch({type: 'UPDATE_SECTION', key: sectionKey, config: {initialCollapse}});
    }
  }, [sectionData, dispatch, sectionKey, initialCollapse]);

  // This controls disabling the InteractionStateLayer when hovering over action items. We don't
  // want selecting an action to appear as though it'll fold/unfold the section.
  const [isLayerEnabled, setIsLayerEnabled] = useState(true);

  const toggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent browser summary/details behaviour
      window.getSelection()?.removeAllRanges(); // Prevent text selection on expand
      trackAnalytics('issue_details.section_fold', {
        sectionKey,
        organization,
        open: !isCollapsed,
      });
      setIsCollapsed(!isCollapsed);
    },
    [organization, sectionKey, isCollapsed, setIsCollapsed]
  );

  return (
    <Fragment>
      <Section
        {...props}
        ref={forwardedRef}
        id={sectionKey}
        scrollMargin={navScrollMargin ?? 0}
      >
        <SectionExpander
          preventCollapse={preventCollapse}
          onClick={preventCollapse ? e => e.preventDefault() : toggleCollapse}
        >
          <InteractionStateLayer
            hidden={preventCollapse ? preventCollapse : !isLayerEnabled}
          />
          <TitleWithActions>
            <TitleWrapper>{title}</TitleWrapper>
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
        </SectionExpander>
        {isCollapsed ? null : (
          <ErrorBoundary mini>
            <Content>{children}</Content>
          </ErrorBoundary>
        )}
      </Section>
      <SectionDivider />
    </Fragment>
  );
});

export const SectionDivider = styled('hr')`
  border-color: ${p => p.theme.translucentBorder};
  margin: ${space(1)} 0;
  &:last-child {
    display: none;
  }
`;

export const Section = styled('section')<{scrollMargin: number}>`
  scroll-margin-top: calc(${space(1)} + ${p => p.scrollMargin ?? 0}px);
`;

const Content = styled('div')`
  padding: ${space(0.5)} ${space(0.75)};
`;

const SectionExpander = styled('div')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: ${space(0.5)} ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: ${p => (p.preventCollapse ? 'initial' : 'pointer')};
  position: relative;
`;

const TitleWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
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
