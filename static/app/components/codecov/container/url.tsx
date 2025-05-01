import type {Location} from 'history';

// Constants
export const CODECOV_URL_PARAM = {
  REPOSITORY: 'repository',
};

// Functions
/**
 * This function sanitizes a url param based on its type. Currently supports strings
 * but can be expanded to support other types if needed.
 */
function _sanitizeKey(value: any): string | null {
  return typeof value === 'string' ? decodeURIComponent(value).trim() : null;
}

/**
 * Gets params from query based on a provided desiredParams. It will
 * loop through desiredParams, try to find the key from query, sanitize the
 * value and ultimately return the found values or nulls.
 */
export function getParamsFromQuery<T extends Record<string, string>>(
  query: Location['query'],
  desiredParams: T
): {[K in keyof T]: string | null} {
  const result = {} as {[K in keyof T]: string | null};

  for (const key in desiredParams) {
    const queryKey = desiredParams[key];
    const rawValue = query[queryKey as string];

    result[queryKey as keyof T] = _sanitizeKey(rawValue);
  }

  return result;
}
