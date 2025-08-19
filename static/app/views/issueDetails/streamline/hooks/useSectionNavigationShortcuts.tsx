import {useCallback, useMemo} from 'react';

import {useComponentShortcuts} from 'sentry/utils/keyboardShortcuts';
import {
  type SectionConfig,
  SectionKey,
  useIssueDetails,
} from 'sentry/views/issueDetails/streamline/context';
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

  const navigateToSection = useCallback((config: SectionConfig) => {
    // Unfold the section if it's collapsed
    const foldKey = getFoldSectionKey(config.key);
    const storedState = localStorage.getItem(foldKey);
    if (storedState === 'true') {
      localStorage.setItem(foldKey, 'false');
    }

    // Scroll to the section
    requestAnimationFrame(() => {
      const element = document.getElementById(config.key);
      if (element) {
        element.scrollIntoView({block: 'start', behavior: 'smooth'});
      }
    });
  }, []);

  const handleNextSection = useCallback(() => {
    if (eventSectionConfigs.length === 0) return;

    // Find current section by checking which section is closest to the top of viewport
    let currentIndex = 0;
    const viewportTop = window.scrollY;
    let closestDistance = Infinity;

    // Find the section that's closest to the top of the viewport
    for (let i = 0; i < eventSectionConfigs.length; i++) {
      const element = document.getElementById(eventSectionConfigs[i].key);
      if (element) {
        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + window.scrollY;
        const distance = Math.abs(elementTop - viewportTop);

        // If this element is closer to the viewport top, consider it current
        if (distance < closestDistance && elementTop <= viewportTop + 200) {
          closestDistance = distance;
          currentIndex = i;
        }
      }
    }

    // Navigate to next section (cycle to first if at end)
    const nextIndex = (currentIndex + 1) % eventSectionConfigs.length;
    navigateToSection(eventSectionConfigs[nextIndex]);
  }, [eventSectionConfigs, navigateToSection]);

  const handlePreviousSection = useCallback(() => {
    if (eventSectionConfigs.length === 0) return;

    // Find current section by checking which section is closest to the top of viewport
    let currentIndex = 0;
    const viewportTop = window.scrollY;
    let closestDistance = Infinity;

    // Find the section that's closest to the top of the viewport
    for (let i = 0; i < eventSectionConfigs.length; i++) {
      const element = document.getElementById(eventSectionConfigs[i].key);
      if (element) {
        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + window.scrollY;
        const distance = Math.abs(elementTop - viewportTop);

        // If this element is closer to the viewport top, consider it current
        if (distance < closestDistance && elementTop <= viewportTop + 200) {
          closestDistance = distance;
          currentIndex = i;
        }
      }
    }

    // Navigate to previous section (cycle to last if at beginning)
    const prevIndex =
      currentIndex === 0 ? eventSectionConfigs.length - 1 : currentIndex - 1;
    navigateToSection(eventSectionConfigs[prevIndex]);
  }, [eventSectionConfigs, navigateToSection]);

  useComponentShortcuts('issue-details-sections', [
    {
      id: 'next-section',
      key: 'j j',
      description: 'Next section',
      handler: handleNextSection,
    },
    {
      id: 'previous-section',
      key: 'j k',
      description: 'Previous section',
      handler: handlePreviousSection,
    },
  ]);
}
