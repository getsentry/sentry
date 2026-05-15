import type {LocationDescriptor} from 'history';

/**
 * Determines if a URL string or LocationDescriptor points to an external resource.
 *
 * A URL is considered external if it is a string that starts with `http://` or `https://`.
 * LocationDescriptor objects are always treated as internal (app-relative) links.
 */
export function isExternalUrl(
  href: string | LocationDescriptor | undefined
): href is string {
  return typeof href === 'string' && /^https?:\/\//.test(href);
}
