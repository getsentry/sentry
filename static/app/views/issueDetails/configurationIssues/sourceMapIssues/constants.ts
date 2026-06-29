import {JavascriptProcessingErrors} from 'sentry/constants/eventErrors';

const SOURCE_MAP_ERROR_TYPES = [
  JavascriptProcessingErrors.JS_MISSING_SOURCE,
  JavascriptProcessingErrors.JS_INVALID_SOURCEMAP,
  JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT,
  JavascriptProcessingErrors.JS_SCRAPING_DISABLED,
  JavascriptProcessingErrors.JS_INVALID_SOURCEMAP_LOCATION,
];

export const SOURCE_MAP_ERROR_TYPES_QUERY = `error_type:[${SOURCE_MAP_ERROR_TYPES.join(',')}]`;
