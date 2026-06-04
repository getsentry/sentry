import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';

/**
 * Trim slug name with a preference for preserving whole words. Only cut up
 * whole words if the last remaining words are still too long.
 *
 * For example:
 *
 *   javascript-project-backend  -> javascript…backend
 *   my-long-sentry-project-name -> my-long…project-name
 *   javascriptproject-backend   -> javascriptproj…ackend
 */
export function trimSlug(slug: string, maxLength = 20) {
  return middleEllipsis(slug, maxLength, '-');
}
