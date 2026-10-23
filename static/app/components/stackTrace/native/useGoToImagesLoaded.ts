import {useCallback} from 'react';

import {useOptionalDebugMetaSearch} from 'sentry/components/events/interfaces/debugMeta/debugMetaSearchContext';
import type {Image} from 'sentry/types/debugImage';
import type {Frame} from 'sentry/types/event';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/foldSection';

/**
 * Images Loaded search term for a frame's address, scoped to its debug image
 * when the address is relative to one.
 */
export function getImagesLoadedSearchTerm(frame: Frame, image: Image | null) {
  if (!frame.instructionAddr) {
    return;
  }

  return frame.addrMode && frame.addrMode !== 'abs' && image
    ? `${image.debug_id}!${frame.instructionAddr}`
    : frame.instructionAddr;
}

/**
 * Returns a handler that filters, expands, and scrolls to the Images Loaded
 * section, or `undefined` when that section isn't on the page.
 *
 * Called once per stack trace so frame rows don't each subscribe to the
 * section's collapse state and the Images Loaded search term.
 */
export function useGoToImagesLoaded(isHoverPreviewed: boolean) {
  const setSearchTerm = useOptionalDebugMetaSearch()?.setSearchTerm;
  const {sectionData} = useIssueDetails();
  const debugSectionConfig = sectionData[SectionKey.DEBUGMETA];
  const [_isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(SectionKey.DEBUGMETA),
    debugSectionConfig?.initialCollapse ?? false
  );

  const goToImagesLoaded = useCallback(
    (searchTerm: string | undefined) => {
      if (searchTerm) {
        setSearchTerm?.(searchTerm);
      }

      setIsCollapsed(false);

      document
        .getElementById(SectionKey.DEBUGMETA)
        ?.scrollIntoView({block: 'start', behavior: 'smooth'});
    },
    [setSearchTerm, setIsCollapsed]
  );

  return !isHoverPreviewed && setSearchTerm && debugSectionConfig
    ? goToImagesLoaded
    : undefined;
}
