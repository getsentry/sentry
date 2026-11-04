import type * as React from 'react';
import {useCallback} from 'react';

import type {PaginationProps} from '@sentry/scraps/pagination';
import {useTranslation} from '@sentry/scraps/translation';

import {parseCursor} from 'sentry/utils/cursor';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';

/** Convert Sentry's API Link header into the portable pagination contract. */
export function getPaginationProps(
  pageLinks: string | null | undefined
): Pick<PaginationProps, 'previous' | 'next'> {
  if (pageLinks === undefined || pageLinks === null) {
    return {};
  }
  const links = parseLinkHeader(pageLinks);
  return {
    previous: {
      cursor: links.previous?.cursor,
      disabled: links.previous?.results === false,
    },
    next: {cursor: links.next?.cursor, disabled: links.next?.results === false},
  };
}

type PaginationCaptionProps = {
  cursor: string | string[] | undefined | null;
  limit: number;
  pageLength: number;
  total: number;
};

/**
 * Returns a function that formats a pagination caption like "1-25 of 100".
 */
export function useGetPaginationCaption() {
  const {tct} = useTranslation();

  return useCallback(
    ({cursor, limit, pageLength, total}: PaginationCaptionProps): React.ReactNode => {
      if (pageLength === 0) {
        return '';
      }

      const currentCursor = parseCursor(cursor);
      const offset = currentCursor?.offset ?? 0;
      const start = offset * limit + 1;
      const end = start + pageLength - 1;

      return tct('[start]-[end] of [total]', {
        start: start.toLocaleString(),
        end: end.toLocaleString(),
        total: total.toLocaleString(),
      });
    },
    [tct]
  );
}
