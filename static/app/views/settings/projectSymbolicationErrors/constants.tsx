import {
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import {t} from 'sentry/locale';

export type SymbolicationCategory = 'native' | 'javascript' | 'jvm' | 'fetch';

export type FixKey = 'debug-symbols' | 'source-maps' | 'proguard' | 'source-fetching';

/** A page under the project settings where the user fixes the cause. */
export const FIXES: Record<FixKey, {label: string; page: string}> = {
  'debug-symbols': {label: t('Upload debug files'), page: 'debug-symbols/'},
  'source-maps': {label: t('Upload source maps'), page: 'source-maps/'},
  proguard: {label: t('Upload ProGuard mapping'), page: 'proguard/'},
  'source-fetching': {label: t('Enable source fetching'), page: ''},
};

export interface SymbolicationErrorInfo {
  category: SymbolicationCategory;
  description: string;
  docsUrl: string;
  label: string;
  /** The fix the user applies in the project settings, if there is one. */
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
  fix?: FixKey
): SymbolicationErrorInfo {
  return {category: 'native', label, description, docsUrl: NATIVE_DOCS, fix};
}

function javascript(
  label: string,
  description: string,
  fix?: FixKey
): SymbolicationErrorInfo {
  return {category: 'javascript', label, description, docsUrl: JS_DOCS, fix};
}

function fetch(label: string, description: string): SymbolicationErrorInfo {
  return {category: 'fetch', label, description, docsUrl: JS_DOCS};
}

function jvm(label: string, description: string, fix?: FixKey): SymbolicationErrorInfo {
  return {category: 'jvm', label, description, docsUrl: PROGUARD_DOCS, fix};
}

export const SYMBOLICATION_ERRORS: Record<string, SymbolicationErrorInfo> = {
  [NativeProcessingErrors.NATIVE_MISSING_DSYM]: native(
    t('Missing debug file'),
    t('No debug information file matched the image, so its frames stay raw addresses.'),
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM]: native(
    t('Missing optional debug file'),
    t(
      'A third-party framework shipped without debug files. Upload them if you need those frames.'
    ),
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_BAD_DSYM]: native(
    t('Corrupt debug file'),
    t('The uploaded debug file could not be read.'),
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_UNSUPPORTED_DSYM]: native(
    t('Unsupported debug file'),
    t('The debug file is in a format Sentry cannot use.'),
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_MISSING_SYMBOL]: native(
    t('Address not in debug file'),
    t(
      'A debug file was found but does not contain the address. The upload may belong to another build.'
    ),
    'debug-symbols'
  ),
  [NativeProcessingErrors.NATIVE_MISSING_SYSTEM_DSYM]: native(
    t('Missing system symbols'),
    t('Sentry has no symbols for this operating system version.')
  ),
  [NativeProcessingErrors.NATIVE_UNKNOWN_IMAGE]: native(
    t('Frame outside known images'),
    t('A frame address did not belong to any image the SDK reported.')
  ),
  [NativeProcessingErrors.NATIVE_SYMBOLICATOR_FAILED]: native(
    t('Symbolication failed'),
    t('The symbolication service returned an error for this event.')
  ),
  [NativeProcessingErrors.NATIVE_INTERNAL_FAILURE]: native(
    t('Internal symbolication failure'),
    t('Symbolication hit an internal error. This is on Sentry, not on your uploads.')
  ),
  [NativeProcessingErrors.NATIVE_SIMULATOR_FRAME]: native(
    t('Simulator frame'),
    t('The frame comes from a simulator build, which has no debug files.')
  ),
  [NativeProcessingErrors.NATIVE_NO_CRASHED_THREAD]: native(
    t('No crashed thread'),
    t('The crash report did not mark a crashed thread.')
  ),
  [JavascriptProcessingErrors.JS_MISSING_SOURCE]: javascript(
    t('Source map not found'),
    t('No source map or minified source matched the frame.'),
    'source-maps'
  ),
  [JavascriptProcessingErrors.JS_INVALID_SOURCEMAP]: javascript(
    t('Invalid source map'),
    t('The source map could not be parsed.'),
    'source-maps'
  ),
  [JavascriptProcessingErrors.JS_INVALID_SOURCEMAP_LOCATION]: javascript(
    t('Invalid source map location'),
    t('The minified file points at a source map location Sentry cannot resolve.'),
    'source-maps'
  ),
  [JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT]: javascript(
    t('Source map lacks sources content'),
    t('The source map has no embedded sources, so Sentry cannot show source context.'),
    'source-maps'
  ),
  [JavascriptProcessingErrors.JS_SCRAPING_DISABLED]: javascript(
    t('Web fetching is off'),
    t(
      'The source was not uploaded and fetching JavaScript sources from the web is disabled.'
    ),
    'source-fetching'
  ),
  [JavascriptProcessingErrors.JS_NO_COLUMN]: javascript(
    t('Frame has no column number'),
    t('Source maps need a column number to map a minified frame.')
  ),
  [JavascriptProcessingErrors.JS_INVALID_CONTENT]: javascript(
    t('Invalid source content'),
    t('The fetched source was not valid JavaScript or a valid source map.')
  ),
  [JavascriptProcessingErrors.JS_TOO_MANY_REMOTE_SOURCES]: javascript(
    t('Too many remote sources'),
    t('The event referenced more remote sources than Sentry fetches per event.')
  ),
  [JavascriptProcessingErrors.JS_INVALID_SOURCE_ENCODING]: javascript(
    t('Invalid source encoding'),
    t('The fetched source used an encoding Sentry cannot read.')
  ),
  [JavascriptProcessingErrors.JS_GENERIC_FETCH_ERROR]: fetch(
    t('Could not fetch source'),
    t('Sentry could not download the source or source map from the web.')
  ),
  [JavascriptProcessingErrors.JS_INVALID_HTTP_CODE]: fetch(
    t('Source returned an error status'),
    t('The web server answered the source request with an error status.')
  ),
  [JavascriptProcessingErrors.JS_TOO_LARGE]: fetch(
    t('Source too large'),
    t('The fetched source exceeded the size limit.')
  ),
  [JavascriptProcessingErrors.JS_FETCH_TIMEOUT]: fetch(
    t('Source fetch timed out'),
    t('The web server did not answer the source request in time.')
  ),
  [HttpProcessingErrors.FETCH_GENERIC_ERROR]: fetch(
    t('Could not fetch file'),
    t('Sentry could not download a source, source map or debug file.')
  ),
  [HttpProcessingErrors.FETCH_INVALID_HTTP_CODE]: fetch(
    t('File returned an error status'),
    t('The server answered the file request with an error status.')
  ),
  [HttpProcessingErrors.FETCH_INVALID_ENCODING]: fetch(
    t('Invalid file encoding'),
    t('The fetched file used an encoding Sentry cannot read.')
  ),
  [HttpProcessingErrors.FETCH_TOO_LARGE]: fetch(
    t('File too large'),
    t('The fetched file exceeded the size limit.')
  ),
  [HttpProcessingErrors.FETCH_TIMEOUT]: fetch(
    t('File fetch timed out'),
    t('The server did not answer the file request in time.')
  ),
  [ProguardProcessingErrors.PROGUARD_MISSING_MAPPING]: jvm(
    t('Missing ProGuard mapping'),
    t('No mapping file matched the build, so class and method names stay obfuscated.'),
    'proguard'
  ),
  [ProguardProcessingErrors.PROGUARD_MISSING_LINENO]: jvm(
    t('Mapping has no line numbers'),
    t('The mapping file was built without line number information.'),
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
    }
  );
}

export const SYMBOLICATION_ERROR_TYPES_QUERY = `error_type:[${Object.keys(
  SYMBOLICATION_ERRORS
).join(',')}]`;

export const STATS_PERIOD = '30d';
export const STATS_INTERVAL = '1d';
