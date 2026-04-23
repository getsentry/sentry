const SOURCE_MAP_ERROR_TYPES = [
  'js_no_source',
  'js_invalid_source',
  'js_missing_sources_content',
  'js_scraping_disabled',
  'js_invalid_sourcemap_location',
];

export const SOURCE_MAP_ERROR_TYPES_QUERY = `error_type:[${SOURCE_MAP_ERROR_TYPES.join(',')}]`;
