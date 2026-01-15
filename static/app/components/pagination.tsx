import {useCallback} from 'react';
import styled from '@emotion/styled';
import type {Query} from 'history';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
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

function Pagination({
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
      <ButtonBar merged gap="0">
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

const PaginationCaption = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.md};
  margin-right: ${space(2)};
`;

export default Pagination;
