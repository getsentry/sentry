import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import Panel from 'sentry/components/panels/panel';
import {
  GridBodyCell,
  GridHead,
  GridHeadCell,
  GridResizer,
  GridRow,
} from 'sentry/components/tables/gridEditable/styles';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {parseCursor} from 'sentry/utils/cursor';
import type parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';

interface EventListTableProps {
  /**
   * Should contain a <GridEditable /> to apply the streamlined styles
   */
  children: React.ReactNode;
  pagination?: {
    /**
     * Whether pagination header is enabled.
     */
    enabled?: boolean;
    /**
     * The links for the pagination buttons
     */
    links?: ReturnType<typeof parseLinkHeader>;
    /**
     * Whether the next page link is disabled
     */
    nextDisabled?: boolean;
    /**
     * Number of results displayed on the current page
     */
    pageCount?: number;
    /**
     * Whether the previous page link is disabled
     */
    previousDisabled?: boolean;
    /**
     * The unit of the table, e.g. "events", "check-ins", "open periods", etc.
     */
    tableUnits?: string;
    /**
     * The total number of results for this table across all pages
     * Needs to be a string | number for <EventsTable /> to work.
     */
    totalCount?: string | number;
  };
  /**
   * The title of the table
   */
  title?: React.ReactNode;
}

export function EventListTable({children, pagination, title}: EventListTableProps) {
  const location = useLocation();
  const {
    links,
    pageCount = 0,
    totalCount,
    nextDisabled,
    previousDisabled,
    tableUnits = 'events',
    enabled: isPaginationEnabled = true,
  } = pagination ?? {};

  const hasHeader = title !== undefined || isPaginationEnabled;

  return (
    <StreamlineGridEditable>
      {hasHeader ? (
        <Header>
          <Title>{title}</Title>
          {isPaginationEnabled ? (
            <Fragment>
              <HeaderItem>
                <PaginationText
                  pageCount={pageCount}
                  totalCount={totalCount}
                  tableUnits={tableUnits}
                />
              </HeaderItem>
              <HeaderItem>
                <ButtonBar gap="2xs">
                  <PaginationButton
                    aria-label={t('Previous Page')}
                    borderless
                    size="xs"
                    icon={<IconChevron direction="left" />}
                    to={{
                      ...location,
                      query: {
                        ...location.query,
                        cursor: links?.previous?.cursor,
                      },
                    }}
                    disabled={previousDisabled}
                  />
                  <PaginationButton
                    aria-label={t('Next Page')}
                    borderless
                    size="xs"
                    icon={<IconChevron direction="right" />}
                    to={{
                      ...location,
                      query: {
                        ...location.query,
                        cursor: links?.next?.cursor,
                      },
                    }}
                    disabled={nextDisabled}
                  />
                </ButtonBar>
              </HeaderItem>
            </Fragment>
          ) : null}
        </Header>
      ) : null}
      {children}
    </StreamlineGridEditable>
  );
}

export const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: ${space(1.5)};
  align-items: center;
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(1.5)};
  background: ${p => p.theme.tokens.background.primary};
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
`;

export const Title = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
`;

export const HeaderItem = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
`;

const StreamlineGridEditable = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};

  ${Panel} {
    border: 0;
    margin-bottom: 0;
  }

  ${GridHead} {
    min-height: unset;
    font-size: ${p => p.theme.fontSize.md};
    ${GridResizer} {
      height: 36px;
    }
  }

  ${GridHeadCell} {
    height: 36px;
    padding: 0 ${space(1.5)};
    white-space: nowrap;
    text-overflow: ellipsis;
    text-transform: none;
    border-width: 0 1px 0 0;
    border-style: solid;
    border-image: linear-gradient(
        to bottom,
        transparent,
        transparent 30%,
        ${p => p.theme.border} 30%,
        ${p => p.theme.border} 70%,
        transparent 70%,
        transparent
      )
      1;
    &:last-child {
      border: 0;
    }
    &:first-child {
      padding-left: ${space(1.5)};
    }
  }

  ${GridBodyCell} {
    min-height: unset;
    padding: ${space(1)} ${space(1.5)};
    font-size: ${p => p.theme.fontSize.md};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  ${GridRow} {
    td:nth-child(2) {
      padding-left: ${space(1.5)};
    }

    td:not(:nth-child(2)) {
      a {
        color: ${p => p.theme.tokens.content.primary};
        text-decoration: underline;
        text-decoration-color: ${p => p.theme.border};
      }
    }
  }
`;

export const PaginationButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

export function PaginationText({
  pageCount = 0,
  totalCount,
  tableUnits,
}: {
  pageCount: Required<EventListTableProps>['pagination']['pageCount'];
  tableUnits: Required<EventListTableProps>['pagination']['tableUnits'];
  totalCount: Required<EventListTableProps>['pagination']['totalCount'];
}) {
  const location = useLocation();
  const currentCursor = parseCursor(location.query?.cursor);
  const start = Math.max(currentCursor?.offset ?? 1, 1);

  if (pageCount === 0) {
    return null;
  }

  return defined(totalCount)
    ? tct('Showing [start]-[end] of [count] matching [tableUnits]', {
        start: start.toLocaleString(),
        end: ((currentCursor?.offset ?? 0) + pageCount).toLocaleString(),
        count: totalCount.toLocaleString(),
        tableUnits,
      })
    : tct('Showing [start]-[end] matching [tableUnits]', {
        start: start.toLocaleString(),
        end: ((currentCursor?.offset ?? 0) + pageCount).toLocaleString(),
        tableUnits,
      });
}
