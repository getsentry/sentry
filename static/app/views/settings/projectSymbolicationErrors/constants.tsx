import {
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import {t} from 'sentry/locale';

type SymbolicationCategory = 'native' | 'javascript' | 'jvm' | 'fetch';

export type FixKey = 'debug-symbols' | 'source-maps' | 'proguard' | 'source-fetching';

export const FIXES: Record<FixKey, {label: string; page: string}> = {
  'debug-symbols': {label: t('Upload debug files'), page: 'debug-symbols/'},
  'source-maps': {label: t('Upload source maps'), page: 'source-maps/'},
  proguard: {label: t('Upload ProGuard mapping'), page: 'proguard/'},
  'source-fetching': {label: t('Enable source fetching'), page: ''},
};

export type GuideKey =
  | 'missing-debug-file'
  | 'wrong-debug-file'
  | 'proguard'
  | 'source-map-not-found'
  | 'broken-source-map'
  | 'fetching-off'
  | 'fetch-failed'
  | 'unmappable'
  | 'no-action';

interface GuideContext {
  orgSlug: string;
  projectSlug: string;
}

interface GuideStep {
  text: string;
  command?: (context: GuideContext) => string;
}

function target({orgSlug, projectSlug}: GuideContext) {
  return `--org ${orgSlug} --project ${projectSlug}`;
}

const uploadDebugFiles = (context: GuideContext) =>
  `sentry-cli debug-files upload ${target(context)} <path-to-debug-files>`;

const uploadSourceMaps = (context: GuideContext) =>
  `sentry-cli sourcemaps inject <build-directory>\nsentry-cli sourcemaps upload ${target(context)} <build-directory>`;

export const GUIDES: Record<GuideKey, GuideStep[]> = {
  'missing-debug-file': [
    {
      text: t(
        'Find the debug files of the affected builds. The releases above show which builds they are.'
      ),
    },
    {text: t('Upload them to this project.'), command: uploadDebugFiles},
    {
      text: t(
        'Add the upload to your build, so that every new release has its debug files.'
      ),
    },
  ],
  'wrong-debug-file': [
    {
      text: t('Check the debug file on your machine.'),
      command: () => 'sentry-cli debug-files check <path-to-debug-file>',
    },
    {
      text: t(
        'Make sure that the file comes from the same build as the app. The debug ID of the file must match the debug ID of the image.'
      ),
    },
    {text: t('Upload the correct file.'), command: uploadDebugFiles},
  ],
  proguard: [
    {
      text: t('Upload the mapping file of each affected build.'),
      command: context =>
        `sentry-cli upload-proguard ${target(context)} <path-to-mapping.txt>`,
    },
    {
      text: t(
        'If line numbers are missing, keep them in your ProGuard rules and build again.'
      ),
      command: () => '-keepattributes SourceFile,LineNumberTable',
    },
    {
      text: t(
        'Set up the Sentry Gradle plugin, so that every build uploads its mapping.'
      ),
    },
  ],
  'source-map-not-found': [
    {
      text: t(
        'Open the event that this panel links to. Use the source map debugger on a frame that is not mapped. It tells you why the source map did not match.'
      ),
    },
    {
      text: t(
        'If the release has no source maps, upload them. Do this in your build, for every release.'
      ),
      command: uploadSourceMaps,
    },
    {
      text: t(
        'If the release has source maps, the file names or the debug IDs do not match. Build and upload again, and deploy the same files that you uploaded.'
      ),
    },
  ],
  'broken-source-map': [
    {
      text: t(
        'Build the release again and check that your bundler writes a complete source map.'
      ),
    },
    {
      text: t(
        'Turn on the sourcesContent option of your bundler, so that the source map contains the original source.'
      ),
    },
    {text: t('Upload the new source maps.'), command: uploadSourceMaps},
  ],
  'fetching-off': [
    {
      text: t('Upload your source maps. This is the reliable fix.'),
      command: uploadSourceMaps,
    },
    {
      text: t(
        'Alternatively, turn on "Enable JavaScript source fetching" in the project settings. Sentry then downloads the files from your server.'
      ),
    },
  ],
  'fetch-failed': [
    {
      text: t(
        'Sentry tried to download the file from your server and failed. Check that the URL is reachable from the public internet.'
      ),
    },
    {
      text: t(
        'If your server needs authentication, set a Security Token in the project settings.'
      ),
    },
    {
      text: t('Better: upload the files, so that Sentry does not need to download them.'),
      command: uploadSourceMaps,
    },
  ],
  unmappable: [
    {
      text: t(
        'Upload your source maps, so that Sentry does not need to download sources from the web.'
      ),
      command: uploadSourceMaps,
    },
    {
      text: t(
        'Events from old browsers that send no column numbers stay minified. An upload does not change that.'
      ),
    },
  ],
  'no-action': [],
};

export interface SymbolicationErrorInfo {
  category: SymbolicationCategory;
  description: string;
  docsUrl: string;
  guide: GuideKey;
  label: string;
  fix?: FixKey;
}

const NATIVE_DOCS =
  'https://docs.sentry.io/platforms/native/data-management/debug-files/';
const JS_DOCS =
  'https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/';
const PROGUARD_DOCS = 'https://docs.sentry.io/platforms/android/enhance-errors/proguard/';

function native(
  label: string,
  description: string,
  guide: GuideKey,
  fix?: FixKey
): SymbolicationErrorInfo {
  return {category: 'native', label, description, docsUrl: NATIVE_DOCS, guide, fix};
}

function javascript(
  label: string,
  description: string,
  guide: GuideKey,
  fix?: FixKey
): SymbolicationErrorInfo {
  return {category: 'javascript', label, description, docsUrl: JS_DOCS, guide, fix};
}

function fetch(
  label: string,
  description: string,
  guide: GuideKey
): SymbolicationErrorInfo {
  return {category: 'fetch', label, description, docsUrl: JS_DOCS, guide};
}

function jvm(
  label: string,
  description: string,
  guide: GuideKey,
  fix?: FixKey
): SymbolicationErrorInfo {
  return {category: 'jvm', label, description, docsUrl: PROGUARD_DOCS, guide, fix};
}

const SYMBOLICATION_ERRORS: Record<string, SymbolicationErrorInfo> = {
  [NativeProcessingErrors.NATIVE_MISSING_DSYM]: native(
    t('Missing debug file'),
    t('No debug information file matched the image, so its frames stay raw addresses.'),
    'missing-debug-file',
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM]: native(
    t('Missing optional debug file'),
    t(
      'A third-party framework shipped without debug files. Upload them if you need those frames.'
    ),
    'missing-debug-file',
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_BAD_DSYM]: native(
    t('Corrupt debug file'),
    t('The uploaded debug file could not be read.'),
    'wrong-debug-file',
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_UNSUPPORTED_DSYM]: native(
    t('Unsupported debug file'),
    t('The debug file is in a format Sentry cannot use.'),
    'wrong-debug-file',
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_MISSING_SYMBOL]: native(
    t('Address not in debug file'),
    t(
      'A debug file was found but does not contain the address. The upload may belong to another build.'
    ),
    'wrong-debug-file',
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_MISSING_SYSTEM_DSYM]: native(
    t('Missing system symbols'),
    t('Sentry has no symbols for this operating system version.'),
    'no-action'
  ),
  [NativeProcessingErrors.NATIVE_UNKNOWN_IMAGE]: native(
    t('Frame outside known images'),
    t('A frame address did not belong to any image the SDK reported.'),
    'no-action'
  ),
  [NativeProcessingErrors.NATIVE_SYMBOLICATOR_FAILED]: native(
    t('Symbolication failed'),
    t('The symbolication service returned an error for this event.'),
    'no-action'
  ),
  [NativeProcessingErrors.NATIVE_INTERNAL_FAILURE]: native(
    t('Internal symbolication failure'),
    t('Symbolication hit an internal error. This is on Sentry, not on your uploads.'),
    'no-action'
  ),
  [NativeProcessingErrors.NATIVE_SIMULATOR_FRAME]: native(
    t('Simulator frame'),
    t('The frame comes from a simulator build, which has no debug files.'),
    'no-action'
  ),
  [NativeProcessingErrors.NATIVE_NO_CRASHED_THREAD]: native(
    t('No crashed thread'),
    t('The crash report did not mark a crashed thread.'),
    'no-action'
  ),
  [JavascriptProcessingErrors.JS_MISSING_SOURCE]: javascript(
    t('Source map not found'),
    t('No source map or minified source matched the frame.'),
    'source-map-not-found',
    'source-maps'
  ),
  [JavascriptProcessingErrors.JS_INVALID_SOURCEMAP]: javascript(
    t('Invalid source map'),
    t('The source map could not be parsed.'),
    'broken-source-map',
    'source-maps'
  ),
  [JavascriptProcessingErrors.JS_INVALID_SOURCEMAP_LOCATION]: javascript(
    t('Invalid source map location'),
    t('The minified file points at a source map location Sentry cannot resolve.'),
    'broken-source-map',
    'source-maps'
  ),
  [JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT]: javascript(
    t('Source map lacks sources content'),
    t('The source map has no embedded sources, so Sentry cannot show source context.'),
    'broken-source-map',
    'source-maps'
  ),
  [JavascriptProcessingErrors.JS_SCRAPING_DISABLED]: javascript(
    t('Web fetching is off'),
    t(
      'The source was not uploaded and fetching JavaScript sources from the web is disabled.'
    ),
    'fetching-off',
    'source-fetching'
  ),
  [JavascriptProcessingErrors.JS_NO_COLUMN]: javascript(
    t('Frame has no column number'),
    t('Source maps need a column number to map a minified frame.'),
    'unmappable'
  ),
  [JavascriptProcessingErrors.JS_INVALID_CONTENT]: javascript(
    t('Invalid source content'),
    t('The fetched source was not valid JavaScript or a valid source map.'),
    'unmappable'
  ),
  [JavascriptProcessingErrors.JS_TOO_MANY_REMOTE_SOURCES]: javascript(
    t('Too many remote sources'),
    t('The event referenced more remote sources than Sentry fetches per event.'),
    'unmappable'
  ),
  [JavascriptProcessingErrors.JS_INVALID_SOURCE_ENCODING]: javascript(
    t('Invalid source encoding'),
    t('The fetched source used an encoding Sentry cannot read.'),
    'unmappable'
  ),
  [JavascriptProcessingErrors.JS_GENERIC_FETCH_ERROR]: fetch(
    t('Could not fetch source'),
    t('Sentry could not download the source or source map from the web.'),
    'fetch-failed'
  ),
  [JavascriptProcessingErrors.JS_INVALID_HTTP_CODE]: fetch(
    t('Source returned an error status'),
    t('The web server answered the source request with an error status.'),
    'fetch-failed'
  ),
  [JavascriptProcessingErrors.JS_TOO_LARGE]: fetch(
    t('Source too large'),
    t('The fetched source exceeded the size limit.'),
    'fetch-failed'
  ),
  [JavascriptProcessingErrors.JS_FETCH_TIMEOUT]: fetch(
    t('Source fetch timed out'),
    t('The web server did not answer the source request in time.'),
    'fetch-failed'
  ),
  [HttpProcessingErrors.FETCH_GENERIC_ERROR]: fetch(
    t('Could not fetch file'),
    t('Sentry could not download a source, source map or debug file.'),
    'fetch-failed'
  ),
  [HttpProcessingErrors.FETCH_INVALID_HTTP_CODE]: fetch(
    t('File returned an error status'),
    t('The server answered the file request with an error status.'),
    'fetch-failed'
  ),
  [HttpProcessingErrors.FETCH_INVALID_ENCODING]: fetch(
    t('Invalid file encoding'),
    t('The fetched file used an encoding Sentry cannot read.'),
    'fetch-failed'
  ),
  [HttpProcessingErrors.FETCH_TOO_LARGE]: fetch(
    t('File too large'),
    t('The fetched file exceeded the size limit.'),
    'fetch-failed'
  ),
  [HttpProcessingErrors.FETCH_TIMEOUT]: fetch(
    t('File fetch timed out'),
    t('The server did not answer the file request in time.'),
    'fetch-failed'
  ),
  [ProguardProcessingErrors.PROGUARD_MISSING_MAPPING]: jvm(
    t('Missing ProGuard mapping'),
    t('No mapping file matched the build, so class and method names stay obfuscated.'),
    'proguard',
    'proguard'
  ),
  [ProguardProcessingErrors.PROGUARD_MISSING_LINENO]: jvm(
    t('Mapping has no line numbers'),
    t('The mapping file was built without line number information.'),
    'proguard',
    'proguard'
  ),
};

export function getSymbolicationErrorInfo(errorType: string): SymbolicationErrorInfo {
  return (
    SYMBOLICATION_ERRORS[errorType] ?? {
      category: 'native',
      label: errorType,
      description: t('Sentry reported a symbolication error it has no description for.'),
      docsUrl: NATIVE_DOCS,
      guide: 'no-action',
    }
  );
}

export const SYMBOLICATION_ERROR_TYPES_QUERY = `error_type:[${Object.keys(
  SYMBOLICATION_ERRORS
).join(',')}]`;

export const STATS_PERIOD = '30d';
export const STATS_INTERVAL = '1d';
