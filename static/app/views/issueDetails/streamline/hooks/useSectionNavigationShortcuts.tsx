import {useCallback, useMemo} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';
import {useLocation} from 'sentry/utils/useLocation';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';

const sectionLabels: Partial<Record<SectionKey, string>> = {
  [SectionKey.HIGHLIGHTS]: 'Highlights',
  [SectionKey.STACKTRACE]: 'Stack Trace',
  [SectionKey.EXCEPTION]: 'Stack Trace',
  [SectionKey.THREADS]: 'Stack Trace',
  [SectionKey.REPLAY]: 'Replay',
  [SectionKey.BREADCRUMBS]: 'Breadcrumbs',
  [SectionKey.TRACE]: 'Trace',
  [SectionKey.LOGS]: 'Logs',
  [SectionKey.TAGS]: 'Tags',
  [SectionKey.CONTEXTS]: 'Context',
  [SectionKey.USER_FEEDBACK]: 'User Feedback',
  [SectionKey.FEATURE_FLAGS]: 'Flags',
};

// Keyboard shortcut mappings for direct section jumps
const sectionShortcuts: Partial<Record<SectionKey, string>> = {
  [SectionKey.HIGHLIGHTS]: 'q h',
  [SectionKey.STACKTRACE]: 'q s',
  [SectionKey.EXCEPTION]: 'q s',
  [SectionKey.THREADS]: 'q s',
  [SectionKey.REPLAY]: 'q y',
  [SectionKey.BREADCRUMBS]: 'q b',
  [SectionKey.TRACE]: 'q c',
  [SectionKey.LOGS]: 'q l',
  [SectionKey.TAGS]: 'q t',
  [SectionKey.CONTEXTS]: 'q x',
  [SectionKey.USER_FEEDBACK]: 'q u',
  [SectionKey.FEATURE_FLAGS]: 'q f',
};

/**
 * Hook for section navigation shortcuts (j/k for next/previous section)
 * Navigates between sections shown in the "Jump to:" area
 */
export function useSectionNavigationShortcuts() {
  const location = useLocation();

  // Only register shortcuts when on issue details pages
  const isOnIssueDetailsPage =
    location.pathname.includes('/issues/') &&
    (location.pathname.includes('/events/') || location.pathname.endsWith('/'));
  const shouldRegisterShortcuts = isOnIssueDetailsPage;

  const navigateToSection = useCallback((sectionKey: SectionKey) => {
    // Unfold the section if it's collapsed
    const foldKey = getFoldSectionKey(sectionKey);
    const storedState = localStorage.getItem(foldKey);
    if (storedState === 'true') {
      localStorage.setItem(foldKey, 'false');
    }

    // Fallback to direct element scrolling for sections without anchors
    const element = document.getElementById(sectionKey);
    if (element) {
      element.scrollIntoView({block: 'start', behavior: 'smooth'});
    }
  }, []);

  // Create handlers for direct section jumps
  const createSectionJumpHandler = useCallback(
    (targetSectionKey: SectionKey) => () => {
      // Direct navigation without needing to check eventSectionConfigs
      navigateToSection(targetSectionKey);
    },
    [navigateToSection]
  );

  // Generate shortcuts for available sections
  const sectionJumpShortcuts = useMemo(() => {
    // Add direct section jump shortcuts for all defined shortcuts
    // This ensures shortcuts work even before sections are rendered
    const directJumpShortcuts = Object.entries(sectionShortcuts)
      .filter(([sectionKey, _]) => sectionLabels[sectionKey as SectionKey]) // Only for sections with labels
      .map(([sectionKey, shortcutKey]) => ({
        id: `jump-to-${sectionKey}`,
        key: shortcutKey,
        description: `Jump to ${sectionLabels[sectionKey as SectionKey]}`,
        handler: createSectionJumpHandler(sectionKey as SectionKey),
      }));

    return directJumpShortcuts;
  }, [createSectionJumpHandler]);

  useComponentShortcuts(
    'issue-details-section-navigation',
    shouldRegisterShortcuts ? sectionJumpShortcuts : []
  );
}
