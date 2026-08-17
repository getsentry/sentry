import {useCallback, useEffect, useRef, useState} from 'react';
import {FFmpeg} from '@ffmpeg/ffmpeg';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {canExportReplayAsVideo} from 'sentry/utils/replays/export/replayVideoExportSupport';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {isRRWebChangeFrame} from 'sentry/utils/replays/types';

const FRAME_FILENAME_DIGITS = 6;
// A frame is always captured at least this often, even during a stretch of
// the replay with no DOM changes at all (e.g. someone just reading a page) —
// otherwise a long idle period would hold on one frame indefinitely instead
// of gently confirming nothing changed.
const MAX_FRAME_GAP_MS = 5000;
const MIN_FRAME_DURATION_S = 0.05;

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

function logDebug(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.debug('[replay-video-export]', ...args);
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
 *    `VideoFrame`s. Rather than capturing at a constant framerate, we walk
 *    the replay's own rrweb events for DOM-mutation timestamps and only
 *    rasterize+encode a frame when the replay's current playback position
 *    reaches one — most of a typical replay is mouse movement or idle time
 *    with no visual change, so this both cuts the CPU cost per captured
 *    frame and (more importantly) the number of frames ffmpeg has to mux at
 *    the end, without needing to touch every single rendered frame.
 * 4. Once capture finishes, ffmpeg's concat demuxer muxes the captured PNGs
 *    into an MP4, each held on screen for exactly as long as it actually
 *    was in the replay (a plain constant framerate would otherwise squash
 *    or stretch the real pacing between sparse, irregularly-spaced
 *    frames). The result is downloaded as a normal browser download (a
 *    plain Blob + `<a download>`, not `showSaveFilePicker` — that API
 *    doesn't exist in every Chromium-based browser; Brave disables it
 *    outright with no way to enable it).
 */
export function useExportReplayVideo() {
  const {rootEl, dimensions, currentTime, isFinished, setCurrentTime, togglePlayPause} =
    useReplayContext();
  const replay = useReplayReader();

  const [state, setState] = useState<ExportState>({status: 'idle', progressPct: 0});

  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<VideoFrame> | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const cancelledRef = useRef(false);
  const isFinishedRef = useRef(isFinished);
  const currentTimeRef = useRef(currentTime);
  // Tracks the last progress "bucket" shown in the loading toast, so we
  // update it every ~5% instead of on every single frame.
  const lastToastBucketRef = useRef(-1);

  useEffect(() => {
    isFinishedRef.current = isFinished;
  }, [isFinished]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

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

  // Persists across the dropdown menu closing (which happens the instant you
  // click the item) — otherwise there's no visible feedback that anything is
  // happening for what can be a multi-minute export.
  const showProgressToast = useCallback((label: string, pct: number | null = null) => {
    if (pct === null) {
      lastToastBucketRef.current = -1;
      addLoadingMessage(label, {duration: null});
      return;
    }
    const bucket = Math.floor(pct * 20); // 5% buckets
    if (bucket === lastToastBucketRef.current) {
      return;
    }
    lastToastBucketRef.current = bucket;
    addLoadingMessage(`${label} ${Math.round(pct * 100)}%`, {duration: null});
  }, []);

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
    const replayDurationMs = replay?.getDurationMs() ?? 0;

    // Every DOM-mutation (or full-snapshot) timestamp, in ms relative to the
    // start of the replay — the playback positions we actually need a frame
    // for. Mouse movement, scrolling, etc. are deliberately not included;
    // they don't necessarily change what's visually on screen.
    const startTimestampMs = replay?.getStartTimestampMs() ?? 0;
    const changeTimestamps = Array.from(
      new Set(
        (replay?.getRRWebFrames() ?? [])
          .filter(isRRWebChangeFrame)
          .map(frame => Math.max(0, frame.timestamp - startTimestampMs))
      )
    ).sort((a, b) => a - b);
    logDebug(
      `${changeTimestamps.length} DOM-change timestamps identified for a ${replayDurationMs}ms replay`
    );

    try {
      setState({status: 'requesting-permission', progressPct: 0});
      showProgressToast(t('Waiting for screen-share permission…'));
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
      showProgressToast(t('Loading video encoder…'));
      const encoderLoadStartedAt = performance.now();
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      ffmpeg.on('log', ({message}) => logDebug('[ffmpeg]', message));
      ffmpeg.on('progress', ({progress}) => {
        const pct = Math.max(0, Math.min(1, progress));
        setState(prev => ({...prev, progressPct: pct}));
        showProgressToast(t('Finishing video…'), pct);
      });
      await ffmpeg.load({
        coreURL: FFMPEG_CORE_URL,
        wasmURL: FFMPEG_CORE_WASM_URL,
      });
      logDebug(
        `encoder loaded in ${Math.round(performance.now() - encoderLoadStartedAt)}ms`
      );
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
      showProgressToast(t('Recording replay…'));

      let frameCount = 0;
      let changeIndex = 0;
      let lastCapturedAtMs = -Infinity;
      const capturedAtMs: number[] = [];
      const recordingStartedAt = performance.now();
      let framesSeen = 0;
      let framesSkipped = 0;

      while (!cancelledRef.current && !isFinishedRef.current) {
        const {value: frame, done} = await reader.read();
        if (done || !frame) {
          break;
        }
        framesSeen += 1;

        const nowMs = currentTimeRef.current;
        const priorChangeIndex = changeIndex;
        while (
          changeIndex < changeTimestamps.length &&
          changeTimestamps[changeIndex]! <= nowMs
        ) {
          changeIndex += 1;
        }
        const shouldCapture =
          frameCount === 0 ||
          isFinishedRef.current ||
          changeIndex > priorChangeIndex ||
          nowMs - lastCapturedAtMs >= MAX_FRAME_GAP_MS;

        if (!shouldCapture) {
          framesSkipped += 1;
          frame.close();
          continue;
        }

        try {
          canvasCtx.drawImage(frame, 0, 0, width, height);
          const blob = await canvas.convertToBlob({type: 'image/png'});
          const data = new Uint8Array(await blob.arrayBuffer());
          await ffmpeg.writeFile(frameFilename(frameCount), data);
          capturedAtMs.push(nowMs);
          lastCapturedAtMs = nowMs;
          frameCount += 1;
          logDebug(
            `captured frame ${frameCount} at replay t=${Math.round(nowMs)}ms` +
              ` (seen ${framesSeen}, skipped ${framesSkipped})`
          );
          const pct = replayDurationMs ? Math.min(1, nowMs / replayDurationMs) : null;
          if (pct !== null) {
            setState(prev => ({...prev, progressPct: pct}));
            showProgressToast(t('Recording replay…'), pct);
          }
        } finally {
          frame.close();
        }
      }
      readerRef.current = null;
      streamRef.current?.getTracks().forEach(mediaTrack => mediaTrack.stop());
      streamRef.current = null;
      logDebug(
        `capture finished in ${Math.round((performance.now() - recordingStartedAt) / 1000)}s:` +
          ` ${frameCount} frames written, ${framesSkipped} skipped (of ${framesSeen} seen)`
      );

      if (cancelledRef.current) {
        return;
      }
      if (frameCount === 0) {
        throw new Error('No frames were captured');
      }

      setState({status: 'finalizing', progressPct: 0});
      showProgressToast(t('Finishing video…'));
      const finalizeStartedAt = performance.now();

      // Frames were captured at irregular intervals (only when something
      // changed), so a constant framerate would misrepresent the replay's
      // real pacing. The concat demuxer instead holds each frame on screen
      // for exactly the gap until the next one.
      const manifestLines: string[] = [];
      for (let i = 0; i < frameCount; i++) {
        const next = capturedAtMs[i + 1] ?? replayDurationMs;
        const durationS = Math.max(
          MIN_FRAME_DURATION_S,
          (next - capturedAtMs[i]!) / 1000
        );
        manifestLines.push(`file '${frameFilename(i)}'`);
        manifestLines.push(`duration ${durationS.toFixed(3)}`);
      }
      // The concat demuxer ignores the final entry's `duration`; repeating
      // the last file once more (with no duration after it) is the
      // documented workaround so it's actually held for its full length.
      manifestLines.push(`file '${frameFilename(frameCount - 1)}'`);
      await ffmpeg.writeFile(
        'concat.txt',
        new TextEncoder().encode(manifestLines.join('\n'))
      );

      await ffmpeg.exec([
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        'concat.txt',
        '-vsync',
        'vfr',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        'out.mp4',
      ]);
      logDebug(
        `ffmpeg mux finished in ${Math.round(performance.now() - finalizeStartedAt)}ms`
      );

      const data = await ffmpeg.readFile('out.mp4');
      const raw = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      const bytes = new Uint8Array(raw.length);
      bytes.set(raw);

      const blob = new Blob([bytes], {type: 'video/mp4'});
      const url = URL.createObjectURL(blob);
      downloadFromHref(filename, url);
      URL.revokeObjectURL(url);
      addSuccessMessage(t('Downloaded %s', filename));
    } catch (error) {
      const isUserCancellation =
        error instanceof DOMException &&
        // The tab-share (getDisplayMedia) prompt was denied or dismissed.
        error.name === 'NotAllowedError';
      if (isUserCancellation) {
        clearIndicators();
      } else {
        // eslint-disable-next-line no-console
        console.error('[replay-video-export]', error);
        Sentry.captureException(error);
        addErrorMessage(t('Could not export replay as video. Please try again.'));
      }
    } finally {
      cleanup();
      setState({status: 'idle', progressPct: 0});
    }
  }, [
    rootEl,
    dimensions,
    replay,
    setCurrentTime,
    togglePlayPause,
    cleanup,
    showProgressToast,
  ]);

  const cancelExport = useCallback(() => {
    cleanup();
    clearIndicators();
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
