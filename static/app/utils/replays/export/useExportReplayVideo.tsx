import {useCallback, useEffect, useRef, useState} from 'react';
import {FFmpeg} from '@ffmpeg/ffmpeg';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {canExportReplayAsVideo} from 'sentry/utils/replays/export/replayVideoExportSupport';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

const CAPTURE_FPS = 30;
const FRAME_FILENAME_DIGITS = 6;

// `@ffmpeg/core`'s ~30MB of wasm+glue is vendored from the installed
// npm package (not committed to git — pulled in at build time from
// node_modules, same as any other dependency) and served from our own
// origin, rather than fetched from a CDN. ffmpeg.wasm's docs recommend a CDN
// with `toBlobURL()`, but that produces a blob: URL that its own internal
// worker then tries to dynamically `import()` — which this project's rspack
// dev server can't resolve ("Cannot find module 'blob:...'"). Same-origin
// URLs sidestep that entirely. `ffmpeg-core.js`/`.wasm` are referenced via
// the `ffmpeg-core.js`/`ffmpeg-core.wasm` aliases in rspack.config.ts
// (pointing straight at the files in node_modules — @ffmpeg/core's
// package.json "exports" field doesn't expose a subpath this project's
// `new URL(..., import.meta.url)` asset resolution can satisfy) rather than
// a bare package specifier. See the `@ffmpeg/core` exclude/asset rules
// there for how these get served unprocessed instead of run through the JS
// bundling pipeline (which breaks ffmpeg-core.js's own wasm-loading paths).
const FFMPEG_CORE_URL = new URL('ffmpeg-core.js', import.meta.url).toString();
const FFMPEG_CORE_WASM_URL = new URL('ffmpeg-core.wasm', import.meta.url).toString();

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

function frameFilename(index: number) {
  return `frame${String(index).padStart(FRAME_FILENAME_DIGITS, '0')}.png`;
}

/**
 * Captures the live replay player (a real iframe + DOM, not a canvas) and
 * downloads it as an MP4. Runs entirely on the main thread for now — the
 * only backgrounding is whatever `@ffmpeg/ffmpeg` does internally (it spins
 * up its own worker to run the actual wasm encode/mux).
 *
 * Pipeline:
 * 1. `getDisplayMedia({preferCurrentTab: true})` captures this tab.
 * 2. Chrome's Region Capture API (`CropTarget` + `track.cropTo`) crops that
 *    capture down to just the player's mount element, at its rendered
 *    proportions, so the output isn't the whole Sentry UI.
 * 3. `MediaStreamTrackProcessor` turns the cropped track into raw
 *    `VideoFrame`s, each rasterized to PNG via `OffscreenCanvas` and written
 *    into ffmpeg.wasm's virtual filesystem.
 * 4. Once capture finishes, a single `ffmpeg -i frame%06d.png ... out.mp4`
 *    pass muxes the whole video, and the result is downloaded as a normal
 *    browser download (a plain Blob + `<a download>`, not
 *    `showSaveFilePicker` — that API doesn't exist in every Chromium-based
 *    browser; Brave disables it outright with no way to enable it).
 */
export function useExportReplayVideo() {
  const {rootEl, dimensions, isFinished, setCurrentTime, togglePlayPause} =
    useReplayContext();
  const replay = useReplayReader();

  const [state, setState] = useState<ExportState>({status: 'idle', progressPct: 0});

  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<VideoFrame> | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const cancelledRef = useRef(false);
  const isFinishedRef = useRef(isFinished);

  useEffect(() => {
    isFinishedRef.current = isFinished;
  }, [isFinished]);

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    ffmpegRef.current?.terminate();
    ffmpegRef.current = null;
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
    const filename = `${replay?.getReplay().id ?? 'replay'}.mp4`;

    try {
      setState({status: 'requesting-permission', progressPct: 0});
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

      setState({status: 'loading-encoder', progressPct: 0});
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      ffmpeg.on('progress', ({progress}) => {
        setState(prev => ({
          ...prev,
          progressPct: Math.max(0, Math.min(1, progress)),
        }));
      });
      await ffmpeg.load({
        coreURL: FFMPEG_CORE_URL,
        wasmURL: FFMPEG_CORE_WASM_URL,
      });
      if (cancelledRef.current) {
        return;
      }

      const canvas = new OffscreenCanvas(width, height);
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) {
        throw new Error('Could not create a canvas context to capture frames');
      }

      const processor = new MediaStreamTrackProcessor({track});
      const reader = processor.readable.getReader();
      readerRef.current = reader;

      // Play the replay through once, from the start, while we're capturing.
      setCurrentTime(0);
      togglePlayPause(true);
      setState({status: 'recording', progressPct: 0});

      let frameCount = 0;
      const totalFrames = ((replay?.getDurationMs() ?? 0) / 1000) * CAPTURE_FPS;
      while (!cancelledRef.current && !isFinishedRef.current) {
        const {value: frame, done} = await reader.read();
        if (done || !frame) {
          break;
        }
        try {
          canvasCtx.drawImage(frame, 0, 0, width, height);
          const blob = await canvas.convertToBlob({type: 'image/png'});
          const data = new Uint8Array(await blob.arrayBuffer());
          await ffmpeg.writeFile(frameFilename(frameCount), data);
          frameCount += 1;
          const framesWritten = frameCount;
          setState(prev => ({
            ...prev,
            progressPct: totalFrames
              ? Math.min(1, framesWritten / totalFrames)
              : prev.progressPct,
          }));
        } finally {
          frame.close();
        }
      }
      readerRef.current = null;
      streamRef.current?.getTracks().forEach(mediaTrack => mediaTrack.stop());
      streamRef.current = null;

      if (cancelledRef.current) {
        return;
      }

      setState({status: 'finalizing', progressPct: 0});
      await ffmpeg.exec([
        '-framerate',
        String(CAPTURE_FPS),
        '-start_number',
        '0',
        '-i',
        `frame%0${FRAME_FILENAME_DIGITS}d.png`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        'out.mp4',
      ]);

      const data = await ffmpeg.readFile('out.mp4');
      const raw = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      const bytes = new Uint8Array(raw.length);
      bytes.set(raw);

      const blob = new Blob([bytes], {type: 'video/mp4'});
      const url = URL.createObjectURL(blob);
      downloadFromHref(filename, url);
      URL.revokeObjectURL(url);
    } catch (error) {
      const isUserCancellation =
        error instanceof DOMException &&
        // The tab-share (getDisplayMedia) prompt was denied or dismissed.
        error.name === 'NotAllowedError';
      if (!isUserCancellation) {
        // eslint-disable-next-line no-console
        console.error('[replay-video-export]', error);
        Sentry.captureException(error);
        addErrorMessage(t('Could not export replay as video. Please try again.'));
      }
    } finally {
      cleanup();
      setState({status: 'idle', progressPct: 0});
    }
  }, [rootEl, dimensions, replay, setCurrentTime, togglePlayPause, cleanup]);

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
