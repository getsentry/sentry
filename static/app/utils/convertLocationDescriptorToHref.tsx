import type {LocationDescriptor} from 'history';
import * as qs from 'query-string';

export function convertLocationDescriptorToHref(location: LocationDescriptor): string {
  if (!location) {
    return '';
  }

  if (typeof location === 'string') {
    return location;
  }

  const {pathname = '/', search = '', hash = '', query} = location;
  let href = pathname;

  if (query) {
    const queryString = qs.stringify(query);
    if (queryString) {
      href += `?${queryString}`;
    }
  } else {
    if (search && search !== '?') {
      href += search;
    }
  }

  if (hash && hash !== '#') {
    href += hash;
  }

  return href;
}
