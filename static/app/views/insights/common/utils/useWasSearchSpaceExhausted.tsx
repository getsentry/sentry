import {useEffect, useState} from 'react';

import parseLinkHeader from 'sentry/utils/parseLinkHeader';

interface Props {
  isLoading: boolean;
  query: string;
  pageLinks?: string;
}

// TODO: Documentation
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
