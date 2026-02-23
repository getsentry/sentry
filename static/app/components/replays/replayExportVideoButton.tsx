import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {openModal} from 'sentry/actionCreators/modal';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ProgressBar from 'sentry/components/progressBar';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ExportProgress} from 'sentry/utils/replays/exportVideo';
import {
  exportReplayAsVideo,
  getProgressMessage,
  getProgressPercent,
} from 'sentry/utils/replays/exportVideo';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

interface ExportVideoModalProps extends ModalRenderProps {
  dimensions: {height: number; width: number};
  durationMs: number;
  replayId: string;
  rrwebEvents: unknown[];
  startTimestampMs: number;
}

function ExportVideoModal({
  Header,
  Body,
  Footer,
  closeModal,
  rrwebEvents,
  startTimestampMs,
  durationMs,
  replayId,
  dimensions,
}: ExportVideoModalProps) {
  const [progress, setProgress] = useState<ExportProgress>({phase: 'idle'});
  const abortControllerRef = useRef<AbortController | null>(null);

  const isExporting = progress.phase === 'capturing' || progress.phase === 'encoding';

  const handleExport = useCallback(
    async (fps: number) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        await exportReplayAsVideo({
          rrwebEvents,
          startTimestampMs,
          durationMs,
          replayId,
          width: dimensions.width,
          height: dimensions.height,
          fps,
          onProgress: setProgress,
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setProgress({phase: 'idle'});
          return;
        }
        // eslint-disable-next-line no-console
        console.error('[ReplayExportVideo] Export failed:', err);
        setProgress({
          phase: 'error',
          errorMessage: err instanceof Error ? err.message : 'Export failed',
        });
      }
    },
    [rrwebEvents, startTimestampMs, durationMs, replayId, dimensions]
  );

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    handleCancel();
    closeModal();
  }, [handleCancel, closeModal]);

  const percent = getProgressPercent(progress);
  const message = getProgressMessage(progress);

  const estimatedFrames = Math.ceil((durationMs / 1000) * 4);
  const estimatedDurationSec = Math.ceil(estimatedFrames * 0.3); // ~300ms per frame

  return (
    <div>
      <Header closeButton>
        <h4>{t('Export Replay as Video')}</h4>
      </Header>
      <Body>
        <Description>
          {t(
            'Generate an MP4 video from this replay. Frames are captured from the replay DOM and encoded into a video file entirely in your browser.'
          )}
        </Description>

        <InfoGrid>
          <InfoLabel>{t('Replay Duration')}</InfoLabel>
          <InfoValue>{formatDuration(durationMs)}</InfoValue>
          <InfoLabel>{t('Resolution')}</InfoLabel>
          <InfoValue>
            {dimensions.width}×{dimensions.height}
          </InfoValue>
          <InfoLabel>{t('Est. Frames (4 FPS)')}</InfoLabel>
          <InfoValue>{estimatedFrames}</InfoValue>
          <InfoLabel>{t('Est. Export Time')}</InfoLabel>
          <InfoValue>~{formatDuration(estimatedDurationSec * 1000)}</InfoValue>
        </InfoGrid>

        {isExporting || progress.phase === 'done' || progress.phase === 'error' ? (
          <ProgressSection>
            <ProgressBar value={percent} />
            <ProgressMessage phase={progress.phase}>{message}</ProgressMessage>
          </ProgressSection>
        ) : null}
      </Body>
      <Footer>
        <FooterActions>
          {isExporting ? (
            <Button onClick={handleCancel} priority="default">
              {t('Cancel')}
            </Button>
          ) : (
            <Button onClick={handleClose} priority="default">
              {t('Close')}
            </Button>
          )}
          <Button
            onClick={() => handleExport(4)}
            priority="primary"
            disabled={isExporting || progress.phase === 'done'}
            icon={<IconDownload />}
          >
            {progress.phase === 'done' ? t('Exported!') : t('Export at 4 FPS')}
          </Button>
        </FooterActions>
      </Footer>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Button that opens the export-as-video modal.
 * Intended to be placed in the replay controller bar.
 */
export default function ReplayExportVideoButton({isLoading}: {isLoading?: boolean}) {
  const replay = useReplayReader();
  const {dimensions, isFetching} = useReplayContext();

  const handleClick = useCallback(() => {
    if (!replay) {
      return;
    }

    const replayRecord = replay.getReplay();
    const rrwebEvents = replay.getRRWebFrames();
    const startTimestampMs = replay.getStartTimestampMs();
    const durationMs = replay.getDurationMs();

    openModal(deps => (
      <ExportVideoModal
        {...deps}
        rrwebEvents={rrwebEvents}
        startTimestampMs={startTimestampMs}
        durationMs={durationMs}
        replayId={replayRecord.id}
        dimensions={dimensions}
      />
    ));
  }, [replay, dimensions]);

  // Don't show for video (mobile) replays — they need a different pipeline
  if (replay?.isVideoReplay()) {
    return null;
  }

  return (
    <Button
      size="sm"
      tooltipProps={{title: t('Export as video')}}
      icon={<IconDownload size="sm" />}
      onClick={handleClick}
      disabled={isLoading || isFetching || !replay}
      aria-label={t('Export replay as video')}
    >
      {t('Export Video')}
    </Button>
  );
}

const Description = styled('p')`
  margin-bottom: ${space(2)};
  color: ${p => p.theme.tokens.content.secondary};
`;

const InfoGrid = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)} ${space(2)};
  margin-bottom: ${space(2)};
`;

const InfoLabel = styled('span')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
`;

const InfoValue = styled('span')`
  color: ${p => p.theme.tokens.content.primary};
`;

const ProgressSection = styled('div')`
  margin-top: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ProgressMessage = styled('span')<{phase: ExportProgress['phase']}>`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p =>
    p.phase === 'error'
      ? p.theme.colors.red400
      : p.phase === 'done'
        ? p.theme.colors.green400
        : p.theme.tokens.content.secondary};
`;

const FooterActions = styled('div')`
  display: flex;
  gap: ${space(1)};
  justify-content: flex-end;
  width: 100%;
`;
