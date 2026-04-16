import {useCallback} from 'react';
import styled from '@emotion/styled';
import type {Query} from 'history';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {parseCursor} from 'sentry/utils/cursor';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

/**
 * @param cursor The string cursor value
 * @param path   The current page pathname
 * @param query  The current query object
 * @param delta  The delta in page number change triggered by the
 *               click. A negative delta would be a "previous" page.
 */
export type CursorHandler = (
  cursor: string | undefined,
  path: string,
  query: Query,
  delta: number
) => void;

type Props = {
  caption?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onCursor?: CursorHandler;
  pageLinks?: string | null;
  paginationAnalyticsEvent?: (direction: string) => void;
  size?: 'zero' | 'xs' | 'sm' | 'md';
  to?: string;
};

export function Pagination({
  to,
  className,
  onCursor,
  paginationAnalyticsEvent,
  pageLinks,
  size = 'sm',
  caption,
  disabled = false,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultCursorHandler = useCallback<CursorHandler>(
    (cursor, path, query) => navigate({pathname: path, query: {...query, cursor}}),
    [navigate]
  );

  if (!defined(pageLinks)) {
    return null;
  }

  const path = to ?? location.pathname;
  const query = location.query;
  const links = parseLinkHeader(pageLinks);
  const previousDisabled = disabled || links.previous?.results === false;
  const nextDisabled = disabled || links.next?.results === false;

  const cursorHandler = onCursor ?? defaultCursorHandler;

  return (
    <Flex
      justify="end"
      align="center"
      margin="2xl 0 0 0"
      className={className}
      data-test-id="pagination"
    >
      {caption && <PaginationCaption>{caption}</PaginationCaption>}
      <ButtonBar>
        <Button
          icon={<IconChevron direction="left" />}
          aria-label={t('Previous')}
          size={size}
          disabled={previousDisabled}
          onClick={() => {
            cursorHandler(links.previous?.cursor, path, query, -1);
            paginationAnalyticsEvent?.('Previous');
          }}
        />
        <Button
          icon={<IconChevron direction="right" />}
          aria-label={t('Next')}
          size={size}
          disabled={nextDisabled}
          onClick={() => {
            cursorHandler(links.next?.cursor, path, query, 1);
            paginationAnalyticsEvent?.('Next');
          }}
        />
      </ButtonBar>
    </Flex>
  );
}

/**
 * Returns a formatted pagination caption like "1-25 of 100"
 */
export function getPaginationCaption({
  cursor,
  limit,
  pageLength,
  total,
}: {
  cursor: string | string[] | undefined | null;
  limit: number;
  pageLength: number;
  total: number;
}): React.ReactNode {
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
}

const PaginationCaption = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  margin-right: ${p => p.theme.space.xl};
`;
