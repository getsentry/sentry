import birdImage from 'sentry-images/brandPageLayout/animated/bird.avif';
import catImage from 'sentry-images/brandPageLayout/animated/cat.avif';
import charactersImage from 'sentry-images/brandPageLayout/animated/characters.avif';
import cloudsImage from 'sentry-images/brandPageLayout/animated/clouds.avif';
import detailsImage from 'sentry-images/brandPageLayout/animated/details.avif';
import errorImage from 'sentry-images/brandPageLayout/animated/error.avif';
import littleBugImage from 'sentry-images/brandPageLayout/animated/little-bug.avif';
import platform01Image from 'sentry-images/brandPageLayout/animated/platform-01.avif';
import platform02Image from 'sentry-images/brandPageLayout/animated/platform-02.avif';
import runningErrorImage from 'sentry-images/brandPageLayout/animated/running-error.avif';
import seerImage from 'sentry-images/brandPageLayout/animated/seer.avif';
import sentryImage from 'sentry-images/brandPageLayout/animated/sentry.avif';
import thumbsUpImage from 'sentry-images/brandPageLayout/animated/thumbs-up.avif';
import trashFireImage from 'sentry-images/brandPageLayout/animated/trash-fire.avif';
import ufoCrashImage from 'sentry-images/brandPageLayout/animated/ufo-crash.avif';
import ufoImage from 'sentry-images/brandPageLayout/animated/ufo.avif';
import wizardImage from 'sentry-images/brandPageLayout/animated/wizard.avif';

export const ARTWORK_WIDTH = 2800;
export const ARTWORK_HEIGHT = 2000;
export const ARTWORK_BLEED = 200;
export const ARTWORK_PLAYBACK_RATE = 2;

interface ArtworkPlacement {
  delay: number;
  height: number;
  id: string;
  src: string;
  width: number;
  x: number;
  y: number;
  drift?: {x?: number; y?: number};
  entrance?: {x?: number; y?: number};
  fps?: number;
}

type ArtworkLayer = ArtworkPlacement &
  (
    | {frames: 1; playback: 'static'}
    | {frames: 2 | 8; playback: 'hover' | 'idle'}
    | {frames: 2; playback: 'reaction'}
  );

/** Coordinates and entrance order follow the illustrator’s delivery composition. */
export const ARTWORK_LAYERS: readonly ArtworkLayer[] = [
  {
    id: 'clouds',
    src: cloudsImage,
    x: 377.78,
    y: 42.82,
    width: 1364.22,
    height: 561.27,
    delay: 1,
    frames: 1,
    playback: 'static',
  },
  {
    id: 'ufo-crash',
    src: ufoCrashImage,
    x: 159.69,
    y: 816.62,
    width: 628.58,
    height: 838.46,
    delay: 0.6,
    frames: 1,
    playback: 'static',
    entrance: {y: -132},
  },
  {
    id: 'platform-01',
    src: platform01Image,
    x: 1595.28,
    y: 47.02,
    width: 1028.28,
    height: 1860.28,
    delay: 0,
    frames: 1,
    playback: 'static',
    entrance: {y: -159},
  },
  {
    id: 'platform-02',
    src: platform02Image,
    x: 1026.32,
    y: 310.07,
    width: 1323.22,
    height: 1801.49,
    delay: 0.3,
    frames: 1,
    playback: 'static',
    entrance: {y: 249},
  },
  {
    id: 'characters',
    src: charactersImage,
    x: 1051.15,
    y: 54.48,
    width: 1475.52,
    height: 1945.1,
    delay: 1.8,
    frames: 1,
    playback: 'static',
  },
  {
    id: 'details',
    src: detailsImage,
    x: 1090.37,
    y: 51.83,
    width: 1340.37,
    height: 1885.21,
    delay: 2.5,
    frames: 1,
    playback: 'static',
  },
  {
    id: 'error',
    src: errorImage,
    x: 2431.54,
    y: 584.79,
    width: 146.81,
    height: 212.53,
    delay: 1.8,
    frames: 1,
    playback: 'static',
  },
  {
    id: 'cat',
    src: catImage,
    x: 1268.98,
    y: 635.1,
    width: 179.4,
    height: 505.09,
    delay: 0.9,
    frames: 2,
    playback: 'reaction',
  },
  {
    id: 'running-error',
    src: runningErrorImage,
    x: 1341.62,
    y: 331.45,
    width: 181,
    height: 165,
    delay: 0.97,
    frames: 8,
    playback: 'hover',
    fps: 10,
  },
  {
    id: 'wizard',
    src: wizardImage,
    x: 1393,
    y: 104.83,
    width: 493.96,
    height: 329.66,
    delay: 3,
    frames: 2,
    playback: 'hover',
  },
  {
    id: 'ufo',
    src: ufoImage,
    x: 2361.31,
    y: 112.78,
    width: 231.08,
    height: 371,
    delay: 3,
    frames: 2,
    playback: 'hover',
  },
  {
    id: 'seer',
    src: seerImage,
    x: 1801.63,
    y: 529.89,
    width: 126.67,
    height: 183.38,
    delay: 3,
    frames: 2,
    playback: 'hover',
  },
  {
    id: 'little-bug',
    src: littleBugImage,
    x: 1362.26,
    y: 1330.72,
    width: 218.89,
    height: 195.04,
    delay: 3,
    frames: 2,
    playback: 'hover',
  },
  {
    id: 'thumbs-up',
    src: thumbsUpImage,
    x: 2042.78,
    y: 1427.18,
    width: 136.21,
    height: 291.5,
    delay: 3,
    frames: 2,
    playback: 'hover',
  },
  {
    id: 'trash-fire',
    src: trashFireImage,
    x: 958,
    y: 994.7,
    width: 235.85,
    height: 294.68,
    delay: 2.6,
    frames: 2,
    playback: 'idle',
    drift: {x: -32},
  },
  {
    id: 'sentry',
    src: sentryImage,
    x: 2086.77,
    y: 652.32,
    width: 362.52,
    height: 409.69,
    delay: 2,
    frames: 2,
    playback: 'idle',
    drift: {y: -21},
  },
  {
    id: 'bird',
    src: birdImage,
    x: 2213.97,
    y: 1017.49,
    width: 510.92,
    height: 347.68,
    delay: 4,
    frames: 2,
    playback: 'idle',
    entrance: {x: 400, y: -357},
    drift: {x: 37, y: -29},
  },
];
