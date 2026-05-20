import {isUrl} from 'sentry/utils/string/isUrl';

// URL.parse accepts hostnames like `*` or `{host}` that are not real navigable hosts.
// Reject wildcard/template characters so we render these as plain text instead of links.
const INVALID_HOSTNAME_CHARS = /[*{}]/;

export function isValidUrl(str: any): boolean {
  // javascript:void(0) is a valid url so ensure it starts with http:// or https://
  if (!isUrl(str)) {
    return false;
  }
  try {
    const {hostname} = new URL(str);
    return !!hostname && !INVALID_HOSTNAME_CHARS.test(hostname);
  } catch {
    return false;
  }
}
