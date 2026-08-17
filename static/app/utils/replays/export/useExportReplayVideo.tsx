import {useCallback, useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import type {EncoderOutboundMessage} from 'sentry/utils/replays/export/replayVideoEncoderMessages';
import {canExportReplayAsVideo} from 'sentry/utils/replays/export/replayVideoExportSupport';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

const CAPTURE_FPS = 30;

type ExportStatus =
  | 'idle'
  | 'requesting-permission'
  | 'loading-encoder'
  | 'recording'
  | 'finalizing';

interface ExportState {
  progressPct: number;
  status: ExportStatus;
}

/**
 * Picks where to save the export, if the browser supports it.
 *
 * Returns null (rather than throwing) both when `showSaveFilePicker` doesn't
 * exist at all, and when it exists but doesn't actually work — some
 * Chromium-based browsers (Brave, notably) disable the File System Access
 * API outright, and calling it there throws rather than being absent. Either
 * way the caller falls back to a normal browser download instead of failing
 * the whole export. A real user cancellation (they saw the picker and hit
 * Cancel) is the one case that should still abort the export, so that's
 * re-thrown for the caller's own cancellation handling.
 */
async function pickSaveHandle(
  suggestedName: string
): Promise<FileSystemFileHandle | null> {
  if (typeof window.showSaveFilePicker !== 'function') {
    return null;
  }
  try {
    return await window.showSaveFilePicker({
      suggestedName,
      types: [{description: 'MP4 video', accept: {'video/mp4': ['.mp4']}}],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return null;
  }
}

/**
 * Captures the live replay player (a real iframe + DOM, not a canvas) and
 * exports it as an MP4.
 *
 * Pipeline:
 * 1. `getDisplayMedia({preferCurrentTab: true})` captures this tab.
 * 2. Chrome's Region Capture API (`CropTarget` + `track.cropTo`) crops that
 *    capture down to just the player's mount element, at its rendered
 *    proportions, so the output isn't the whole Sentry UI.
 * 3. `MediaStreamTrackProcessor` turns the cropped track into a stream of
 *    raw `VideoFrame`s, which are transferred (not copied) into a worker.
 * 4. The worker rasterizes each frame to PNG and writes it into ffmpeg.wasm's
 *    virtual filesystem. Once capture finishes, a single `ffmpeg -i
 *    frame%06d.png ... out.mp4` pass muxes the whole video.
 * 5. If `showSaveFilePicker` is available, the result is written to the
 *    `FileSystemWritableFileStream` it returned. Otherwise (e.g. Brave,
 *    which disables that API) the finished video is sent back to the main
 *    thread and downloaded the normal way.
 */
export function useExportReplayVideo() {
  const {rootEl, dimensions, isFinished, setCurrentTime, togglePlayPause} =
    useReplayContext();
  const replay = useReplayReader();

  const [state, setState] = useState<ExportState>({status: 'idle', progressPct: 0});

  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<VideoFrame> | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const exportVideo = useCallback(async () => {
    if (!canExportReplayAsVideo()) {
      addErrorMessage(t('Video export is not supported in this browser.'));
      return;
    }
    if (!rootEl) {
      addErrorMessage(t('Replay player is not ready yet.'));
      return;
    }

    cancelledRef.current = false;
    setState({status: 'requesting-permission', progressPct: 0});

    const filename = `${replay?.getReplay().id ?? 'replay'}.mp4`;

    try {
      const handle = await pickSaveHandle(filename);

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        preferCurrentTab: true,
        video: true,
        audio: false,
      });
      streamRef.current = displayStream;

      const [track] = displayStream.getVideoTracks();
      if (!track) {
        throw new Error('No video track captured');
      }

      const cropTarget = await CropTarget.fromElement(rootEl);
      await track.cropTo?.(cropTarget);

      const settings = track.getSettings();
      const width = settings.width ?? dimensions.width;
      const height = settings.height ?? dimensions.height;

      const worker = new Worker(
        new URL('sentry/utils/replays/export/replayVideoEncoder.worker', import.meta.url),
        {type: 'module'}
      );
      workerRef.current = worker;

      let isReady = false;
      let rejectReady: (error: Error) => void = () => {};
      const ready = new Promise<void>((resolve, reject) => {
        rejectReady = reject;
        worker.onmessage = (event: MessageEvent<EncoderOutboundMessage>) => {
          const message = event.data;
          if (message.type === 'ready') {
            isReady = true;
            resolve();
          } else if (message.type === 'capturing') {
            const totalFrames = ((replay?.getDurationMs() ?? 0) / 1000) * CAPTURE_FPS;
            setState(prev => ({
              ...prev,
              progressPct: totalFrames
                ? Math.min(1, message.framesWritten / totalFrames)
                : prev.progressPct,
            }));
          } else if (message.type === 'encoding') {
            setState(prev => ({...prev, progressPct: message.ratio}));
          } else if (message.type === 'download') {
            const blob = new Blob([message.bytes], {type: 'video/mp4'});
            const url = URL.createObjectURL(blob);
            downloadFromHref(message.filename, url);
            URL.revokeObjectURL(url);
            cleanup();
            setState({status: 'idle', progressPct: 0});
          } else if (message.type === 'error') {
            // eslint-disable-next-line no-console
            console.error('[replay-video-export]', message.message);
            Sentry.captureMessage('Replay video export failed', {extra: {message}});
            if (isReady) {
              // `ready` already resolved, so nothing is awaiting its
              // rejection below — report and clean up right here instead.
              addErrorMessage(t('Could not export replay as video. Please try again.'));
              cleanup();
              setState({status: 'idle', progressPct: 0});
            } else {
              // Rejecting routes this through the `await ready` below, whose
              // surrounding try/catch handles the toast + cleanup once.
              reject(new Error(message.message));
            }
          } else if (message.type === 'done') {
            cleanup();
            setState({status: 'idle', progressPct: 0});
          }
        };
      });

      worker.onerror = (event: ErrorEvent) => {
        // Fires if the worker script itself fails to load or throws outside
        // the try/catch in its onmessage handler (e.g. blocked by CSP,
        // network failure fetching the chunk, syntax error).
        // eslint-disable-next-line no-console
        console.error(
          '[replay-video-export] worker failed to load',
          event.message,
          event
        );
        Sentry.captureException(event.error ?? new Error(event.message));
        if (isReady) {
          addErrorMessage(t('Could not export replay as video. Please try again.'));
          cleanup();
          setState({status: 'idle', progressPct: 0});
        } else {
          // Routes through the `await ready` below via its try/catch,
          // instead of leaving that await hanging forever.
          rejectReady(event.error ?? new Error(event.message));
        }
      };
      worker.postMessage({
        type: 'init',
        handle,
        width,
        height,
        fps: CAPTURE_FPS,
        filename,
      });

      setState({status: 'loading-encoder', progressPct: 0});
      await ready;
      if (cancelledRef.current) {
        return;
      }

      const processor = new MediaStreamTrackProcessor({track});
      const reader = processor.readable.getReader();
      readerRef.current = reader;

      // Play the replay through once, from the start, while we're capturing.
      setCurrentTime(0);
      togglePlayPause(true);
      setState({status: 'recording', progressPct: 0});

      const pump = async () => {
        while (!cancelledRef.current) {
          const {value: frame, done} = await reader.read();
          if (done || !frame) {
            break;
          }
          worker.postMessage({type: 'frame', frame}, [frame]);
        }
      };
      pump().catch(error => {
        // eslint-disable-next-line no-console
        console.error('[replay-video-export]', error);
        Sentry.captureException(error);
      });
    } catch (error) {
      const isUserCancellation =
        error instanceof DOMException &&
        // AbortError: the save-file picker was cancelled.
        // NotAllowedError: the tab-share (getDisplayMedia) prompt was
        // denied or dismissed.
        (error.name === 'AbortError' || error.name === 'NotAllowedError');
      if (!isUserCancellation) {
        // eslint-disable-next-line no-console
        console.error('[replay-video-export]', error);
        Sentry.captureException(error);
        addErrorMessage(t('Could not export replay as video. Please try again.'));
      }
      cleanup();
      setState({status: 'idle', progressPct: 0});
    }
  }, [rootEl, dimensions, replay, setCurrentTime, togglePlayPause, cleanup]);

  // Once the replay finishes playing, stop capturing and let the worker
  // finalize + close (or hand back) the file.
  useEffect(() => {
    if (state.status === 'recording' && isFinished) {
      setState(prev => ({...prev, status: 'finalizing'}));
      readerRef.current?.cancel().catch(() => {});
      streamRef.current?.getTracks().forEach(track => track.stop());
      workerRef.current?.postMessage({type: 'stop'});
    }
  }, [state.status, isFinished]);

  const cancelExport = useCallback(() => {
    cleanup();
    setState({status: 'idle', progressPct: 0});
  }, [cleanup]);

  return {
    isSupported: canExportReplayAsVideo(),
    status: state.status,
    progressPct: state.progressPct,
    exportVideo,
    cancelExport,
  };
}
