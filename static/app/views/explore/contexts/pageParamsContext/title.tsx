import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';

export function defaultTitle(): string | undefined {
  return undefined;
}

export function getTitleFromLocation(location: Location) {
  return decodeScalar(location.query.title);
}

export function updateLocationWithTitle(
  location: Location,
  title: string | null | undefined
) {
  if (defined(title)) {
    location.query.title = title;
  } else if (title === null) {
    delete location.query.title;
  }
}
