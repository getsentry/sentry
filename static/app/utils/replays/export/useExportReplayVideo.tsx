import {useCallback, useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import type {EncoderOutboundMessage} from 'sentry/utils/replays/export/replayVideoEncoderMessages';
import {canExportReplayAsVideo} from 'sentry/utils/replays/export/replayVideoExportSupport';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

const CAPTURE_FPS = 30;

type ExportStatus = 'idle' | 'requesting-permission' | 'recording' | 'finalizing';

interface ExportState {
  progressPct: number;
  status: ExportStatus;
}

/**
 * Captures the live replay player (a real iframe + DOM, not a canvas) and
 * streams it out to an MP4 on disk.
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
 *    frame%06d.png ... out.mp4` pass muxes the whole video, and the result is
 *    written to a `FileSystemWritableFileStream` obtained from
 *    `showSaveFilePicker`.
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

    try {
      const handle = await window.showSaveFilePicker?.({
        suggestedName: `${replay?.getReplay().id ?? 'replay'}.mp4`,
        types: [{description: 'MP4 video', accept: {'video/mp4': ['.mp4']}}],
      });
      if (!handle) {
        setState({status: 'idle', progressPct: 0});
        return;
      }

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
      worker.onmessage = (event: MessageEvent<EncoderOutboundMessage>) => {
        const message = event.data;
        if (message.type === 'capturing') {
          const totalFrames = ((replay?.getDurationMs() ?? 0) / 1000) * CAPTURE_FPS;
          setState(prev => ({
            ...prev,
            progressPct: totalFrames
              ? Math.min(1, message.framesWritten / totalFrames)
              : prev.progressPct,
          }));
        } else if (message.type === 'encoding') {
          setState(prev => ({...prev, progressPct: message.ratio}));
        } else if (message.type === 'error') {
          Sentry.captureMessage('Replay video export failed', {extra: {message}});
          addErrorMessage(t('Could not export replay as video. Please try again.'));
          cleanup();
          setState({status: 'idle', progressPct: 0});
        } else if (message.type === 'done') {
          cleanup();
          setState({status: 'idle', progressPct: 0});
        }
      };
      worker.postMessage({type: 'init', handle, width, height, fps: CAPTURE_FPS});

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
        Sentry.captureException(error);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // User dismissed a permission prompt; not an error worth reporting.
      } else {
        Sentry.captureException(error);
        addErrorMessage(t('Could not export replay as video. Please try again.'));
      }
      cleanup();
      setState({status: 'idle', progressPct: 0});
    }
  }, [rootEl, dimensions, replay, setCurrentTime, togglePlayPause, cleanup]);

  // Once the replay finishes playing, stop capturing and let the worker
  // finalize + close the file.
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
