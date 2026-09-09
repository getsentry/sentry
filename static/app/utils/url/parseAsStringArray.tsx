import {parseAsNativeArrayOf, parseAsString} from 'nuqs';

/**
 * Sentry encodes list params as repeated keys (`?project=1&project=2`) rather
 * than a single delimited value, so the native array parser is the correct one.
 */
export const parseAsStringArray = parseAsNativeArrayOf(parseAsString);
