import React, {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
import {Separator} from 'sentry/components/core/separator';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

export function getFoldSectionKey(key: SectionKey) {
  // Original key had a typo, this will migrate existing keys to the correct key
  const localStorageValue = localStorage.getItem(
    `'issue-details-fold-section-collapse:${key}`
  );
  if (localStorageValue) {
    localStorage.removeItem(`'issue-details-fold-section-collapse:${key}`);
    localStorage.setItem(`issue-details-fold-section-collapse:${key}`, localStorageValue);
  }
  return `issue-details-fold-section-collapse:${key}`;
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
  additionalIdentifier?: string;
  className?: string;
  dataTestId?: string;
  /**
   * Disable persisting collapse state to localStorage
   */
  disableCollapsePersistence?: boolean;
  /**
   * Should this section be initially open, gets overridden by user preferences
   */
  initialCollapse?: boolean;
  /**
   * Disable the ability for the user to collapse the section
   */
  preventCollapse?: boolean;
  ref?: React.Ref<HTMLElement>;
  style?: CSSProperties;
}

function useOptionalLocalStorageState(
  key: SectionKey,
  initialState: boolean,
  disablePersistence: boolean
): [boolean, (value: boolean) => void] {
  const [localState, setLocalState] = useState(initialState);
  const [persistedState, setPersistedState] = useSyncedLocalStorageState(
    getFoldSectionKey(key),
    initialState
  );

  return disablePersistence
    ? [localState, setLocalState]
    : [persistedState, setPersistedState];
}

function useScrollToSection(
  sectionKey: SectionKey,
  expanded: boolean,
  setIsCollapsed: (value: boolean) => void
): React.RefCallback<HTMLElement | null> {
  const hasAttemptedScroll = useRef(false);
  const {navScrollMargin} = useIssueDetails();

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
          if (!expanded) {
            setIsCollapsed(false);
          }

          // Delay scrollIntoView to allow for layout changes to take place
          setTimeout(() => element?.scrollIntoView(), 100);
        }
      }
    },
    [sectionKey, navScrollMargin, expanded, setIsCollapsed]
  );

  return scrollToSection;
}

export function FoldSection({
  ref,
  children,
  title,
  actions,
  sectionKey,
  className,
  initialCollapse = false,
  preventCollapse = false,
  disableCollapsePersistence = false,
  additionalIdentifier = '',
  dataTestId,
}: FoldSectionProps) {
  const organization = useOrganization();
  const {sectionData, navScrollMargin, dispatch} = useIssueDetails();

  const [isCollapsed, setIsCollapsed] = useOptionalLocalStorageState(
    sectionKey,
    initialCollapse,
    disableCollapsePersistence
  );

  const expanded = !isCollapsed;
  const scrollToSection = useScrollToSection(sectionKey, expanded, setIsCollapsed);

  // If the section is prevented from collapsing, we need to update the local storage state and open
  useEffect(() => {
    if (preventCollapse) {
      setIsCollapsed(false);
    }
  }, [preventCollapse, setIsCollapsed]);

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
        open: expanded,
        org_streamline_only: organization.streamlineOnly ?? undefined,
      });
      setIsCollapsed(expanded);
    },
    [organization, sectionKey, expanded, setIsCollapsed]
  );

  const labelPrefix = expanded ? t('Collapse') : t('View');
  const labelSuffix = typeof title === 'string' ? title + t(' Section') : t('Section');

  return (
    <Fragment>
      <Section
        ref={mergeRefs(ref, scrollToSection)}
        id={sectionKey + additionalIdentifier}
        scrollMargin={navScrollMargin ?? 0}
        role="region"
        // XXX: We should eventually only use titles as string, or explicitly pass them to stay accessible
        aria-label={typeof title === 'string' ? title : sectionKey}
        className={className}
        data-test-id={dataTestId ?? sectionKey + additionalIdentifier}
      >
        <SectionExpander
          preventCollapse={preventCollapse}
          onClick={preventCollapse ? e => e.preventDefault() : toggleCollapse}
          role="button"
          aria-label={`${labelPrefix} ${labelSuffix}`}
          aria-expanded={expanded}
        >
          <InteractionStateLayer
            hasSelectedBackground={false}
            hidden={preventCollapse ? preventCollapse : !isLayerEnabled}
          />
          <IconWrapper preventCollapse={preventCollapse}>
            <IconChevron direction={expanded ? 'down' : 'right'} size="xs" />
          </IconWrapper>
          <TitleWithActions preventCollapse={preventCollapse}>
            <TitleWrapper>{title}</TitleWrapper>
            {expanded && (
              <div
                onClick={e => e.stopPropagation()}
                onMouseEnter={() => setIsLayerEnabled(false)}
                onMouseLeave={() => setIsLayerEnabled(true)}
              >
                {actions}
              </div>
            )}
          </TitleWithActions>
        </SectionExpander>
        {expanded ? (
          <ErrorBoundary mini>
            <Flex direction="column" padding="xs sm" marginLeft={{xs: 'xl'}}>
              {children}
            </Flex>
          </ErrorBoundary>
        ) : null}
      </Section>
      <Separator orientation="horizontal" margin="lg 0" />
    </Fragment>
  );
}

export const SectionDivider = styled(Separator)`
  &:last-child {
    display: none;
  }
`;

export const SidebarFoldSection = styled(FoldSection)`
  font-size: ${p => p.theme.fontSize.md};
  margin: -${space(1)};
`;

const Section = styled('section')<{scrollMargin: number}>`
  scroll-margin-top: calc(${space(1)} + ${p => p.scrollMargin ?? 0}px);
`;

const SectionExpander = styled('div')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: ${p => p.theme.space.xs};
  align-items: center;
  padding: ${space(0.5)} ${space(1.5)};
  margin: 0 -${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: ${p => (p.preventCollapse ? 'initial' : 'pointer')};
  position: relative;
`;

const TitleWrapper = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
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
