import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Query} from 'history';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';

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
  size?: 'zero' | 'xs' | 'sm';
  to?: string;
};

const defaultOnCursor: CursorHandler = (cursor, path, query, _direction) =>
  browserHistory.push({
    pathname: path,
    query: {...query, cursor},
  });

const Pagination = ({
  to,
  className,
  onCursor = defaultOnCursor,
  paginationAnalyticsEvent,
  pageLinks,
  size = 'sm',
  caption,
  disabled = false,
}: Props) => {
  const location = useLocation();
  if (!pageLinks) {
    return null;
  }

  const path = to ?? location.pathname;
  const query = location.query;
  const links = parseLinkHeader(pageLinks);
  const previousDisabled = disabled || links.previous?.results === false;
  const nextDisabled = disabled || links.next?.results === false;

  return (
    <Wrapper className={className} data-test-id="pagination">
      {caption && <PaginationCaption>{caption}</PaginationCaption>}
      <ButtonBar merged>
        <Button
          icon={<IconChevron direction="left" size="sm" />}
          aria-label={t('Previous')}
          size={size}
          disabled={previousDisabled}
          onClick={() => {
            onCursor?.(links.previous?.cursor, path, query, -1);
            paginationAnalyticsEvent?.('Previous');
          }}
        />
        <Button
          icon={<IconChevron direction="right" size="sm" />}
          aria-label={t('Next')}
          size={size}
          disabled={nextDisabled}
          onClick={() => {
            onCursor?.(links.next?.cursor, path, query, 1);
            paginationAnalyticsEvent?.('Next');
          }}
        />
      </ButtonBar>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin: ${space(3)} 0 0 0;
`;

const PaginationCaption = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(2)};
`;

export default Pagination;
