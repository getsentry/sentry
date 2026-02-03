import React, {
  Fragment,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Separator, type SeparatorProps} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import ErrorBoundary from 'sentry/components/errorBoundary';
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
  ref?: React.Ref<HTMLDivElement>;
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
): React.RefCallback<HTMLDivElement | null> {
  const hasAttemptedScroll = useRef(false);
  const {navScrollMargin} = useIssueDetails();

  const scrollToSection = useCallback(
    (element: HTMLDivElement | null) => {
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
  useLayoutEffect(() => {
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

  // Unregister section when component unmounts
  useLayoutEffect(() => {
    return () => {
      dispatch({
        type: 'REMOVE_EVENT_SECTION',
        key: sectionKey,
      });
    };
  }, [dispatch, sectionKey]);

  const onExpandedChange = useCallback(() => {
    if (preventCollapse) {
      return;
    }
    trackAnalytics('issue_details.section_fold', {
      sectionKey,
      organization,
      open: !isCollapsed,
      org_streamline_only: organization.streamlineOnly ?? undefined,
    });
    setIsCollapsed(!isCollapsed);
  }, [organization, sectionKey, setIsCollapsed, preventCollapse, isCollapsed]);

  const labelPrefix = expanded ? t('Collapse') : t('View');
  const labelSuffix = typeof title === 'string' ? title + t(' Section') : t('Section');

  return (
    <Fragment>
      <DisclosureWithScrollMargin
        as="section"
        size="md"
        role="region"
        ref={mergeRefs(ref, scrollToSection)}
        id={sectionKey + additionalIdentifier}
        className={className}
        // XXX: We should eventually only use titles as string, or explicitly pass them to stay accessible
        aria-label={typeof title === 'string' ? title : sectionKey}
        data-test-id={dataTestId ?? sectionKey + additionalIdentifier}
        scrollMargin={navScrollMargin ?? 0}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
      >
        <Disclosure.Title
          aria-label={`${labelPrefix} ${labelSuffix}`}
          trailingItems={expanded ? actions : undefined}
        >
          <Text size="lg">{title}</Text>
        </Disclosure.Title>
        <Disclosure.Content>
          <ErrorBoundary mini>{expanded ? children : null}</ErrorBoundary>
        </Disclosure.Content>
      </DisclosureWithScrollMargin>
      <SectionDivider orientation="horizontal" margin="lg 0" />
    </Fragment>
  );
}

export const SectionDivider = styled(
  ({orientation, margin, ...props}: SeparatorProps) => (
    <Separator
      orientation={orientation || 'horizontal'}
      margin={margin || 'lg 0'}
      {...props}
    />
  )
)`
  &:last-child {
    display: none;
  }
`;

export const SidebarFoldSection = styled(FoldSection)`
  font-size: ${p => p.theme.font.size.md};
  margin: -${space(1)};
`;

const DisclosureWithScrollMargin = styled(Disclosure)<{scrollMargin: number}>`
  scroll-margin-top: calc(${space(1)} + ${p => p.scrollMargin ?? 0}px);
`;
