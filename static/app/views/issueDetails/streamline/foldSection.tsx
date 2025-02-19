import {
  type CSSProperties,
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import mergeRefs from 'sentry/utils/mergeRefs';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

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
    className,
    initialCollapse = false,
    preventCollapse = false,
  },
  forwardedRef
) {
  const organization = useOrganization();
  const {sectionData, navScrollMargin, dispatch} = useIssueDetails();
  const [isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(sectionKey),
    initialCollapse
  );
  const hasAttemptedScroll = useRef(false);

  // If the section is prevented from collapsing, we need to update the local storage state and open
  useEffect(() => {
    if (preventCollapse) {
      setIsCollapsed(false);
    }
  }, [preventCollapse, setIsCollapsed]);

  const scrollToSection = useCallback(
    (element: HTMLElement | null) => {
      if (!element || !navScrollMargin || hasAttemptedScroll.current) {
        return;
      }
      // Prevent scrolling to element on rerenders
      hasAttemptedScroll.current = true;

      // scroll to element if it's the current section on page load
      if (window.location.hash) {
        const [, hash] = window.location.hash.split('#');
        if (hash === sectionKey) {
          if (isCollapsed) {
            setIsCollapsed(false);
          }

          // Delay scrollIntoView to allow for layout changes to take place
          setTimeout(() => element?.scrollIntoView(), 100);
        }
      }
    },
    [sectionKey, navScrollMargin, isCollapsed, setIsCollapsed]
  );

  useLayoutEffect(() => {
    if (!sectionData.hasOwnProperty(sectionKey)) {
      dispatch({
        type: 'UPDATE_EVENT_SECTION',
        key: sectionKey,
        // If the section is prevented from collapsing, we don't want to persist the initial collapse state
        config: {initialCollapse: preventCollapse ? false : initialCollapse},
      });
    }
  }, [sectionData, dispatch, sectionKey, initialCollapse, preventCollapse]);

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
        org_streamline_only: organization.streamlineOnly ?? undefined,
      });
      setIsCollapsed(!isCollapsed);
    },
    [organization, sectionKey, isCollapsed, setIsCollapsed]
  );
  const labelPrefix = isCollapsed ? t('View') : t('Collapse');
  const labelSuffix = typeof title === 'string' ? title + t(' Section') : t('Section');

  return (
    <Fragment>
      <Section
        ref={mergeRefs([forwardedRef, scrollToSection])}
        id={sectionKey}
        scrollMargin={navScrollMargin ?? 0}
        role="region"
        className={className}
      >
        <SectionExpander
          preventCollapse={preventCollapse}
          onClick={preventCollapse ? e => e.preventDefault() : toggleCollapse}
          role="button"
          aria-label={`${labelPrefix} ${labelSuffix}`}
          aria-expanded={!isCollapsed}
        >
          <InteractionStateLayer
            hasSelectedBackground={false}
            hidden={preventCollapse ? preventCollapse : !isLayerEnabled}
          />
          <TitleWithActions preventCollapse={preventCollapse}>
            <TitleWrapper>{title}</TitleWrapper>
            {!isCollapsed && (
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
  margin: ${space(1.5)} 0;
  &:last-child {
    display: none;
  }
`;

export const SidebarFoldSection = styled(FoldSection)`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: -${space(1)};
`;

const Section = styled('section')<{scrollMargin: number}>`
  scroll-margin-top: calc(${space(1)} + ${p => p.scrollMargin ?? 0}px);
`;

const Content = styled('div')`
  padding: ${space(0.5)} ${space(0.75)};
`;

const SectionExpander = styled('div')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: ${space(0.5)} ${space(1.5)};
  margin: 0 -${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: ${p => (p.preventCollapse ? 'initial' : 'pointer')};
  position: relative;
`;

const TitleWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  user-select: none;
`;

const IconWrapper = styled('div')<{preventCollapse: boolean}>`
  color: ${p => p.theme.subText};
  line-height: 0;
  display: ${p => (p.preventCollapse ? 'none' : 'block')};
`;

const TitleWithActions = styled('div')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  margin-right: ${p => (p.preventCollapse ? 0 : space(1))};
  align-items: center;
  /* Usually the actions are buttons, this height allows actions appearing after opening the
  details section to not expand the summary */
  min-height: 26px;
`;
