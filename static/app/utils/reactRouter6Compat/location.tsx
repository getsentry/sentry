import type {Location as Location6, To} from 'react-router-dom';
import * as Sentry from '@sentry/react';
import type {Location as Location3, LocationDescriptor, Query} from 'history';
import * as qs from 'query-string';

/**
 * Translates a react-router 3 LocationDescriptor to a react-router 6 To.
 */
export function locationDescriptorToTo(path: LocationDescriptor): To {
  if (typeof path === 'string') {
    return path;
  }

  let query = path.query ? {...path.query} : undefined;

  const to: To = {
    pathname: path.pathname,
  };

  // XXX(epurkhiser): In react router 3 it was possible to include the search
  // query parameters in te pathname field of a LocationDescriptor. You can no
  // longer do this with 6 and it will result in an error
  //
  // > Cannot include a '?' character in a manually specified `to.pathname` field
  //
  // To shim for this, since there may be some hiding around, we can extract
  // out the query string, parse it, and merge it into the path query object.

  if (to.pathname?.endsWith('?')) {
    to.pathname = to.pathname.slice(0, -1);
  }

  if (to.pathname?.includes('?')) {
    const parts = to.pathname.split('?');

    Sentry.captureMessage('Got pathname with `?`', scope =>
      scope.setExtra('LocationDescriptor', path)
    );

    if (parts.length > 2) {
      Sentry.captureMessage(
        'Unexpected number of `?` when shimming search params in pathname for react-router 6'
      );
    }

    const [pathname, search] = parts;

    if (search && path.search) {
      Sentry.captureMessage('Got search in pathname and as part of LocationDescriptor');
    }

    to.pathname = pathname;

    if (query) {
      query = {...query, ...qs.parse(search)};
    } else {
      query = qs.parse(search);
    }
  }

  if (path.hash) {
    to.hash = path.hash;
  }
  if (path.search) {
    to.search = path.search;
  }
  if (query) {
    to.search = `?${qs.stringify(query)}`;
  }

  // XXX(epurkhiser): We ignore the location state param

  return to;
}

type DefaultQuery<T = string> = {
  [key: string]: T | T[] | null | undefined;
};

/**
 * Translate react-router 6 Location object to a react-router3 Location
 */
export function location6ToLocation3<Q extends Query = DefaultQuery>(
  location: Location6
): Location3<Q> {
  const {pathname, search, hash, state, key} = location;

  return {
    pathname,
    search,
    query: qs.parse(search) as Q,
    hash,
    state,
    key,

    // XXX(epurkhiser): It would be possible to extract this from the
    // react-router 6 browserHistory object. But beecause of how we're
    // shimming it it's a little hard, so for now just mock
    action: 'POP',
  } satisfies Location3<Q>;
}
