import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import getCurrentUrl from 'sentry/utils/replays/getCurrentUrl';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';
import {openSeerExplorer} from 'sentry/views/seerExplorer/openSeerExplorer';
import {useExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

import InspectElementModal from './inspectElementModal';
import useInspectMode from './useInspectMode';

interface Props {
  isLoading?: boolean;
}

export default function InspectModeToggle({isLoading}: Props) {
  const organization = useOrganization();
  const replay = useReplayReader();
  const {isVideoReplay, currentTime} = useReplayContext();
  const {openExplorerPanel} = useExplorerPanel();

  const {
    isInspecting,
    selectedElement,
    enableInspect,
    disableInspect,
    clearSelectedElement,
  } = useInspectMode();

  const handleSend = useCallback(
    (message: string) => {
      disableInspect();

      // openSeerExplorer stores the pending message options via a DOM event.
      // Normally it also tries to open the panel via a simulated keyboard shortcut,
      // but that shortcut is disabled while a modal is open. Instead, we call
      // openExplorerPanel() directly from context to open the panel. The panel's
      // useExternalOpen visibility effect will pick up the pending options and
      // process the message once the panel is visible.
      openSeerExplorer({
        startNewRun: true,
        initialMessage: message,
      });
      openExplorerPanel();
    },
    [disableInspect, openExplorerPanel]
  );

  // Hide for video replays or when Seer Explorer is not enabled
  if (isVideoReplay || !isSeerExplorerEnabled(organization)) {
    return null;
  }

  return (
    <span>
      <Button
        size="sm"
        tooltipProps={{
          title: isInspecting
            ? t('Exit element inspector')
            : t('Inspect element & ask Seer'),
        }}
        icon={<IconFocus size="sm" />}
        aria-pressed={isInspecting}
        priority={isInspecting ? 'primary' : 'default'}
        onClick={() => (isInspecting ? disableInspect() : enableInspect())}
        aria-label={t('Inspect element')}
        disabled={isLoading}
      />
      {selectedElement ? (
        <InspectElementModal
          element={selectedElement}
          promptContext={{
            replayId: replay?.getReplay().id,
            currentTimestampMs: currentTime,
            currentUrl: getCurrentUrl(
              replay?.getReplay(),
              replay?.getNavigationFrames(),
              currentTime
            ),
          }}
          onClose={clearSelectedElement}
          onSend={handleSend}
        />
      ) : null}
    </span>
  );
}
