import type {LoaderDefinitionFunction} from '@rspack/core';

/**
 * @ffmpeg/ffmpeg's worker.js dynamically imports whatever `coreURL` it's
 * given at runtime — a specifier that's genuinely unresolvable at build
 * time, and only carries a Vite-specific `@vite-ignore` escape hatch, not
 * webpack/rspack's equivalent. Without `webpackIgnore: true`, rspack's
 * dev-server module runtime intercepts the call and tries (and fails) to
 * resolve it through its own chunk registry, instead of leaving it for the
 * browser's native dynamic import to handle.
 *
 * This is a documented, known issue for ffmpeg.wasm + webpack — see
 * https://github.com/ffmpegwasm/ffmpeg.wasm/issues/619 — that later
 * versions of the library are meant to have fixed themselves, but the
 * installed 0.12.15 still only has `@vite-ignore` on this line.
 */
const ffmpegWorkerImportIgnoreLoader: LoaderDefinitionFunction = function (source) {
  return source.replace(
    /import\(\s*\/\*\s*@vite-ignore\s*\*\/\s*_coreURL\)/,
    'import(/* webpackIgnore: true */ /* @vite-ignore */ _coreURL)'
  );
};

export default ffmpegWorkerImportIgnoreLoader;
