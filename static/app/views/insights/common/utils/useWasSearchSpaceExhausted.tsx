import {useEffect, useState} from 'react';

import parseLinkHeader from 'sentry/utils/parseLinkHeader';

interface Props {
  isLoading: boolean;
  query: string;
  pageLinks?: string;
}

/**
 * Keeps track of the passed responses. Remembers if at any point a response
 *  had no query, and didn't have any subsequent data. This means that at
 * some point, a _complete_ response was served. Useful for caches and re-fetch
 * behavior where we want to _avoid fetches_ if we know we've loaded the
 * entire data set at some point and a cache is full.
 */
export function useWasSearchSpaceExhausted({query, isLoading, pageLinks}: Props) {
  const [wasSearchSpaceExhausted, setWasSearchSpaceExhausted] = useState<boolean>(false);

  useEffect(() => {
    if (query === '' && !isLoading) {
      const {next} = parseLinkHeader(pageLinks ?? '');

      if (!next) {
        setWasSearchSpaceExhausted(true);
      }
    }
  }, [query, isLoading, pageLinks]);

  return wasSearchSpaceExhausted;
}
