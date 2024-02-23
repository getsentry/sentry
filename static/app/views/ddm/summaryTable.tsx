import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import colorFn from 'color';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconLightning, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {DEFAULT_SORT_STATE} from 'sentry/utils/metrics/constants';
import {formatMetricsUsingUnitAndOp} from 'sentry/utils/metrics/formatters';
import type {FocusedMetricsSeries, SortState} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Series} from 'sentry/views/ddm/chart/types';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

export const SummaryTable = memo(function SummaryTable({
  series,
  onRowClick,
  onColorDotClick,
  onSortChange,
  sort = DEFAULT_SORT_STATE as SortState,
  setHoveredSeries,
}: {
  onRowClick: (series: FocusedMetricsSeries) => void;
  onSortChange: (sortState: SortState) => void;
  series: Series[];
  onColorDotClick?: (series: FocusedMetricsSeries) => void;
  setHoveredSeries?: (seriesName: string) => void;
  sort?: SortState;
}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const hasActions = series.some(s => s.release || s.transaction);
  const hasMultipleSeries = series.length > 1;

  const changeSort = useCallback(
    (name: SortState['name']) => {
      trackAnalytics('ddm.widget.sort', {
        organization,
        by: name ?? '(none)',
        order: sort.order,
      });
      Sentry.metrics.increment('ddm.widget.sort', 1, {
        tags: {
          by: name ?? '(none)',
          order: sort.order,
        },
      });
      if (sort.name === name) {
        if (sort.order === 'desc') {
          onSortChange(DEFAULT_SORT_STATE as SortState);
        } else if (sort.order === 'asc') {
          onSortChange({
            name,
            order: 'desc',
          });
        } else {
          onSortChange({
            name,
            order: 'asc',
          });
        }
      } else {
        onSortChange({
          name,
          order: 'asc',
        });
      }
    },
    [sort, onSortChange, organization]
  );

  const releaseTo = (release: string) => {
    return {
      pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(
        release
      )}/`,
      query: {
        pageStart: selection.datetime.start,
        pageEnd: selection.datetime.end,
        pageStatsPeriod: selection.datetime.period,
        project: selection.projects,
        environment: selection.environments,
      },
    };
  };

  const transactionTo = (transaction: string) =>
    transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction,
      projectID: selection.projects.map(p => String(p)),
      query: {
        query: '',
        environment: selection.environments,
        start: selection.datetime.start
          ? getUtcDateString(selection.datetime.start)
          : undefined,
        end: selection.datetime.end
          ? getUtcDateString(selection.datetime.end)
          : undefined,
        statsPeriod: selection.datetime.period,
      },
    });

  const rows = series
    .map(s => {
      return {
        ...s,
        ...getValues(s.data),
      };
    })
    .sort((a, b) => {
      const {name, order} = sort;
      if (!name) {
        return 0;
      }

      if (name === 'name') {
        return order === 'asc'
          ? a.seriesName.localeCompare(b.seriesName)
          : b.seriesName.localeCompare(a.seriesName);
      }
      const aValue = a[name] ?? 0;
      const bValue = b[name] ?? 0;

      return order === 'asc' ? aValue - bValue : bValue - aValue;
    });

  return (
    <SummaryTableWrapper hasActions={hasActions}>
      <TableHeaderWrapper hasActions={hasActions}>
        <HeaderCell disabled />
        <SortableHeaderCell onClick={changeSort} sortState={sort} name="name">
          {t('Name')}
        </SortableHeaderCell>
        <SortableHeaderCell onClick={changeSort} sortState={sort} name="avg" right>
          {t('Avg')}
        </SortableHeaderCell>
        <SortableHeaderCell onClick={changeSort} sortState={sort} name="min" right>
          {t('Min')}
        </SortableHeaderCell>
        <SortableHeaderCell onClick={changeSort} sortState={sort} name="max" right>
          {t('Max')}
        </SortableHeaderCell>
        <SortableHeaderCell onClick={changeSort} sortState={sort} name="sum" right>
          {t('Sum')}
        </SortableHeaderCell>
        {hasActions && <HeaderCell disabled right />}
      </TableHeaderWrapper>
      <TableBodyWrapper
        hasActions={hasActions}
        onMouseLeave={() => {
          if (hasMultipleSeries) {
            setHoveredSeries?.('');
          }
        }}
      >
        {rows.map(
          ({
            seriesName,
            id,
            groupBy,
            color,
            hidden,
            unit,
            operation,
            transaction,
            release,
            avg,
            min,
            max,
            sum,
          }) => {
            return (
              <Fragment key={id}>
                <CellWrapper
                  onClick={() => {
                    if (hasMultipleSeries) {
                      onRowClick({
                        id,
                        groupBy,
                      });
                    }
                  }}
                  onMouseEnter={() => {
                    if (hasMultipleSeries) {
                      setHoveredSeries?.(id);
                    }
                  }}
                >
                  <Cell
                    onClick={event => {
                      event.stopPropagation();
                      if (hasMultipleSeries) {
                        onColorDotClick?.({
                          id,
                          groupBy,
                        });
                      }
                    }}
                  >
                    <ColorDot
                      color={color}
                      isHidden={!!hidden}
                      style={{
                        backgroundColor: hidden
                          ? 'transparent'
                          : colorFn(color).alpha(1).string(),
                      }}
                    />
                  </Cell>
                  <TextOverflowCell>
                    <Tooltip
                      title={<FullSeriesName seriesName={seriesName} groupBy={groupBy} />}
                      delay={500}
                      overlayStyle={{maxWidth: '80vw'}}
                    >
                      <TextOverflow>{seriesName}</TextOverflow>
                    </Tooltip>
                  </TextOverflowCell>
                  {/* TODO(ddm): Add a tooltip with the full value, don't add on click in case users want to copy the value */}
                  <Cell right>{formatMetricsUsingUnitAndOp(avg, unit, operation)}</Cell>
                  <Cell right>{formatMetricsUsingUnitAndOp(min, unit, operation)}</Cell>
                  <Cell right>{formatMetricsUsingUnitAndOp(max, unit, operation)}</Cell>
                  <Cell right>{formatMetricsUsingUnitAndOp(sum, unit, operation)}</Cell>
                </CellWrapper>
                {hasActions && (
                  <Cell right>
                    <ButtonBar gap={0.5}>
                      {transaction && (
                        <div>
                          <Tooltip title={t('Open Transaction Summary')}>
                            <LinkButton
                              to={transactionTo(transaction)}
                              size="zero"
                              borderless
                            >
                              <IconLightning size="sm" />
                            </LinkButton>
                          </Tooltip>
                        </div>
                      )}

                      {release && (
                        <div>
                          <Tooltip title={t('Open Release Details')}>
                            <LinkButton to={releaseTo(release)} size="zero" borderless>
                              <IconReleases size="sm" />
                            </LinkButton>
                          </Tooltip>
                        </div>
                      )}
                    </ButtonBar>
                  </Cell>
                )}
              </Fragment>
            );
          }
        )}
      </TableBodyWrapper>
    </SummaryTableWrapper>
  );
});

function FullSeriesName({
  seriesName,
  groupBy,
}: {
  seriesName: string;
  groupBy?: Record<string, string>;
}) {
  if (!groupBy || Object.keys(groupBy).length === 0) {
    return <Fragment>{seriesName}</Fragment>;
  }

  const goupByEntries = Object.entries(groupBy);
  return (
    <Fragment>
      {goupByEntries.map(([key, value], index) => {
        const formattedValue = value || t('(none)');
        return (
          <span key={key}>
            <strong>{`${key}:`}</strong>
            &nbsp;
            {index === goupByEntries.length - 1 ? formattedValue : `${formattedValue}, `}
          </span>
        );
      })}
    </Fragment>
  );
}

function SortableHeaderCell({
  sortState,
  name,
  right,
  children,
  onClick,
}: {
  children: React.ReactNode;
  name: SortState['name'];
  onClick: (name: SortState['name']) => void;
  sortState: SortState;
  right?: boolean;
}) {
  const sortIcon =
    sortState.name === name ? (
      <IconArrow size="xs" direction={sortState.order === 'asc' ? 'up' : 'down'} />
    ) : (
      ''
    );

  if (right) {
    return (
      <HeaderCell
        onClick={() => {
          onClick(name);
        }}
        right
      >
        {sortIcon} {children}
      </HeaderCell>
    );
  }

  return (
    <HeaderCell
      onClick={() => {
        onClick(name);
      }}
    >
      {children} {sortIcon}
    </HeaderCell>
  );
}

function getValues(seriesData: Series['data']) {
  if (!seriesData) {
    return {min: null, max: null, avg: null, sum: null};
  }
  const res = seriesData.reduce(
    (acc, {value}) => {
      if (value === null) {
        return acc;
      }

      acc.min = Math.min(acc.min, value);
      acc.max = Math.max(acc.max, value);
      acc.sum += value;
      acc.definedDatapoints += 1;

      return acc;
    },
    {min: Infinity, max: -Infinity, sum: 0, definedDatapoints: 0}
  );

  return {min: res.min, max: res.max, sum: res.sum, avg: res.sum / res.definedDatapoints};
}

const SummaryTableWrapper = styled(`div`)<{hasActions: boolean}>`
  display: grid;

  grid-template-areas:
    'header'
    'body';

  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const TableHeaderWrapper = styled('div')<{hasActions: boolean}>`
  grid-area: header;
  position: sticky;
  top: 0;
  display: grid;
  grid-template-columns: ${p =>
    p.hasActions ? `${space(3)} 8fr repeat(5, 1fr)` : `${space(3)} 8fr repeat(4, 1fr)`};

  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const TableBodyWrapper = styled('div')<{hasActions: boolean}>`
  grid-area: body;
  display: grid;
  grid-template-columns: ${p =>
    p.hasActions ? `${space(3)} 8fr repeat(5, 1fr)` : `${space(3)} 8fr repeat(4, 1fr)`};

  overflow-y: auto;
  scrollbar-gutter: stable;
  max-height: 170px;
`;

const HeaderCell = styled('div')<{disabled?: boolean; right?: boolean}>`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  line-height: ${p => p.theme.text.lineHeightBody};
  font-family: ${p => p.theme.text.family};
  display: flex;
  flex-direction: row;
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
  padding: ${space(0.5)} ${space(1)};
  gap: ${space(0.5)};
  user-select: none;

  :hover {
    cursor: ${p => (p.disabled ? 'auto' : 'pointer')};
    border-left: 1px solid ${p => p.theme.border};
    border-right: 1px solid ${p => p.theme.border};
  }
`;

const Cell = styled('div')<{right?: boolean}>`
  display: flex;
  padding: ${space(0.25)} 0;
  align-items: center;
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
  white-space: nowrap;
`;

const TextOverflowCell = styled(Cell)`
  min-width: 0;
`;

const ColorDot = styled(`div`)<{color: string; isHidden: boolean}>`
  border: 1px solid ${p => p.color};
  border-radius: 50%;
  width: ${space(1)};
  height: ${space(1)};
`;

const CellWrapper = styled('div')`
  display: contents;
  &:hover {
    cursor: pointer;
    ${Cell}, ${TextOverflowCell} {
      background-color: ${p => p.theme.bodyBackground};
    }
  }
`;
