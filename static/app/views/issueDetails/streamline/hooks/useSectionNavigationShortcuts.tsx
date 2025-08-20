import {useCallback, useMemo} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
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

// Map SectionKey to hash anchors for direct navigation
const sectionAnchors: Partial<Record<SectionKey, string>> = {
  [SectionKey.HIGHLIGHTS]: '#highlights',
  [SectionKey.STACKTRACE]: '#stacktrace',
  [SectionKey.EXCEPTION]: '#exception',
  [SectionKey.THREADS]: '#threads',
  [SectionKey.REPLAY]: '#replay',
  [SectionKey.BREADCRUMBS]: '#breadcrumbs',
  [SectionKey.TRACE]: '#trace',
  [SectionKey.LOGS]: '#logs',
  [SectionKey.TAGS]: '#tags',
  [SectionKey.CONTEXTS]: '#contexts',
  [SectionKey.USER_FEEDBACK]: '#user-feedback',
  [SectionKey.FEATURE_FLAGS]: '#feature-flags',
};

/**
 * Hook for section navigation shortcuts (j/k for next/previous section)
 * Navigates between sections shown in the "Jump to:" area
 */
export function useSectionNavigationShortcuts() {
  const {sectionData} = useIssueDetails();

  // Get available sections (same logic as EventTitle component)
  const eventSectionConfigs = useMemo(() => {
    return Object.values(sectionData ?? {}).filter(config => sectionLabels[config.key]);
  }, [sectionData]);

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

  const handleNextSection = useCallback(() => {
    if (eventSectionConfigs.length === 0) return;

    // Find current section from URL hash
    const currentHash = window.location.hash;
    let currentIndex = 0;

    if (currentHash) {
      const currentSectionIndex = eventSectionConfigs.findIndex(
        config => sectionAnchors[config.key] === currentHash
      );
      if (currentSectionIndex !== -1) {
        currentIndex = currentSectionIndex;
      }
    }

    // Navigate to next section (cycle to first if at end)
    const nextIndex = (currentIndex + 1) % eventSectionConfigs.length;
    const nextSection = eventSectionConfigs[nextIndex];
    if (nextSection) {
      navigateToSection(nextSection.key);
    }
  }, [eventSectionConfigs, navigateToSection]);

  const handlePreviousSection = useCallback(() => {
    if (eventSectionConfigs.length === 0) return;

    // Find current section from URL hash
    const currentHash = window.location.hash;
    let currentIndex = 0;

    if (currentHash) {
      const currentSectionIndex = eventSectionConfigs.findIndex(
        config => sectionAnchors[config.key] === currentHash
      );
      if (currentSectionIndex !== -1) {
        currentIndex = currentSectionIndex;
      }
    }

    // Navigate to previous section (cycle to last if at beginning)
    const prevIndex =
      currentIndex === 0 ? eventSectionConfigs.length - 1 : currentIndex - 1;
    const prevSection = eventSectionConfigs[prevIndex];
    if (prevSection) {
      navigateToSection(prevSection.key);
    }
  }, [eventSectionConfigs, navigateToSection]);

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
    const baseShortcuts = [
      {
        id: 'next-section',
        key: 'j',
        description: 'Jump to next section',
        handler: handleNextSection,
      },
      {
        id: 'previous-section',
        key: 'k',
        description: 'Jump to previous section',
        handler: handlePreviousSection,
      },
    ];

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

    return [...baseShortcuts, ...directJumpShortcuts];
  }, [handleNextSection, handlePreviousSection, createSectionJumpHandler]);

  useComponentShortcuts('issue-details-navigation', sectionJumpShortcuts);
}
