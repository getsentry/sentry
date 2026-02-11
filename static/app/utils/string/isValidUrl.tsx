import {isUrl} from 'sentry/utils/string/isUrl';

export function isValidUrl(str: any): boolean {
  // javascript:void(0) is a valid url so ensure it starts with http:// or https://
  if (!isUrl(str)) {
    return false;
  }
  try {
    return !!new URL(str);
  } catch {
    return false;
  }
}
