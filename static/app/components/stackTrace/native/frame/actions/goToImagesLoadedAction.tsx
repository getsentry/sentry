import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {DebugMetaStore} from 'sentry/stores/debugMetaStore';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';

export function useGoToImagesLoaded() {
  const {frame, frameIndex} = useStackTraceFrameContext();
  const {imageByFrameIndex, isHoverPreviewed} = useNativeStackTraceContext();
  const image = imageByFrameIndex.get(frameIndex) ?? null;

  const isClickable =
    !!frame.symbolicatorStatus &&
    frame.symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE &&
    !isHoverPreviewed;

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

      DebugMetaStore.updateFilter(searchTerm);

      document
        .getElementById(SectionKey.DEBUGMETA)
        ?.scrollIntoView({block: 'start', behavior: 'smooth'});
    },
  };
}
