import type {Location as Location6, To} from 'react-router-dom';
import type {Location as Location3, LocationDescriptor, Query} from 'history';
import * as qs from 'query-string';

/**
 * Translates a react-router 3 LocationDescriptor to a react-router 6 To.
 */
export function locationDescriptorToTo(path: LocationDescriptor): To {
  if (typeof path === 'string') {
    return path;
  }

  const to: To = {
    pathname: path.pathname,
  };

  if (path.hash) {
    to.hash = path.hash;
  }
  if (path.search) {
    to.search = path.search;
  }
  if (path.query) {
    to.search = `?${qs.stringify(path.query)}`;
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
    pathname: pathname,
    search: search,
    query: qs.parse(search) as Q,
    hash: hash,
    state,
    key,

    // XXX(epurkhiser): It would be possible to extract this from the
    // react-router 6 browserHistory object. But beecause of how we're
    // shimming it it's a little hard, so for now just mock
    action: 'POP',
  } satisfies Location3<Q>;
}
