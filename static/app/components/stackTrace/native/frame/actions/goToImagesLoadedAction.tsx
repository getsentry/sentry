import {useOptionalDebugMetaSearch} from 'sentry/components/events/interfaces/debugMeta/debugMetaSearchContext';
import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {SectionKey} from 'sentry/views/issueDetails/context';

export function useGoToImagesLoaded() {
  const {frame, frameIndex} = useStackTraceFrameContext();
  const {imageByFrameIndex, isHoverPreviewed} = useNativeStackTraceContext();
  const debugMetaSearch = useOptionalDebugMetaSearch();
  const image = imageByFrameIndex.get(frameIndex) ?? null;

  const isClickable =
    !!frame.symbolicatorStatus &&
    frame.symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE &&
    !isHoverPreviewed &&
    !!debugMetaSearch;

  return {
    isClickable,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!frame.instructionAddr) {
        return;
      }

      const useDebugId = !!frame.addrMode && frame.addrMode !== 'abs' && image;
      const searchTerm = useDebugId
        ? `${image.debug_id}!${frame.instructionAddr}`
        : frame.instructionAddr;

      debugMetaSearch?.setSearchTerm(searchTerm);

      document
        .getElementById(SectionKey.DEBUGMETA)
        ?.scrollIntoView({block: 'start', behavior: 'smooth'});
    },
  };
}
