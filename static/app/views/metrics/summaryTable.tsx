import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import colorFn from 'color';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import type {Series} from 'sentry/components/metrics/chart/types';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconFilter, IconLightning, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricAggregation} from 'sentry/types/metrics';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {DEFAULT_SORT_STATE} from 'sentry/utils/metrics/constants';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {
  type FocusedMetricsSeries,
  MetricSeriesFilterUpdateType,
  type SortState,
} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

export const SummaryTable = memo(function SummaryTable({
  series,
  onRowClick,
  onColorDotClick,
  onSortChange,
  sort = DEFAULT_SORT_STATE as SortState,
  onRowHover,
  onRowFilter,
}: {
  onRowClick: (series: FocusedMetricsSeries) => void;
  onSortChange: (sortState: SortState) => void;
  series: Series[];
  onColorDotClick?: (series: FocusedMetricsSeries) => void;
  onRowFilter?: (
    index: number,
    series: FocusedMetricsSeries,
    updateType: MetricSeriesFilterUpdateType
  ) => void;
  onRowHover?: (seriesName: string) => void;
  sort?: SortState;
}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const totalColumns = getTotalColumns(series);
  const canFilter = series.length > 1 && !!onRowFilter;
  const hasActions = series.some(s => s.release || s.transaction) || canFilter;
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

  const handleRowFilter = useCallback(
    (
      index: number | undefined,
      row: FocusedMetricsSeries,
      updateType: MetricSeriesFilterUpdateType
    ) => {
      if (index === undefined) {
        return;
      }
      trackAnalytics('ddm.widget.add_row_filter', {
        organization,
      });
      onRowFilter?.(index, row, updateType);
    },
    [onRowFilter, organization]
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
        ...getTotals(s),
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
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const aValue = a[name] ?? 0;
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const bValue = b[name] ?? 0;

      return order === 'asc' ? aValue - bValue : bValue - aValue;
    });

  // We do not want to render the table if there is no data to display
  // If the data is being loaded, then the whole chart will be in a loading state and this is being handled by the parent component
  if (!rows.length) {
    return null;
  }

  return (
    <SummaryTableWrapper
      hasActions={hasActions}
      totalColumnsCount={totalColumns.length}
      data-test-id="summary-table"
    >
      <HeaderCell disabled />
      <HeaderCell disabled />
      <SortableHeaderCell onClick={changeSort} sortState={sort} name="name">
        {t('Name')}
      </SortableHeaderCell>
      {totalColumns.map(aggregate => (
        <SortableHeaderCell
          key={aggregate}
          onClick={changeSort}
          sortState={sort}
          name={aggregate}
          right
        >
          {aggregate}
        </SortableHeaderCell>
      ))}
      {hasActions && <HeaderCell disabled right />}
      <HeaderCell disabled />
      <TableBodyWrapper
        hasActions={hasActions}
        onMouseLeave={() => {
          if (hasMultipleSeries) {
            onRowHover?.('');
          }
        }}
      >
        {rows.map(row => {
          return (
            <Fragment key={row.id}>
              <Row
                onClick={() => {
                  if (hasMultipleSeries) {
                    onRowClick({id: row.id, groupBy: row.groupBy});
                  }
                }}
                onMouseEnter={() => {
                  if (hasMultipleSeries) {
                    onRowHover?.(row.id);
                  }
                }}
              >
                <PaddingCell />
                <Cell
                  onClick={event => {
                    event.stopPropagation();
                    if (hasMultipleSeries) {
                      onColorDotClick?.(row);
                    }
                  }}
                >
                  <ColorDot
                    color={row.color}
                    isHidden={!!row.hidden}
                    style={{
                      backgroundColor: row.hidden
                        ? 'transparent'
                        : colorFn(row.color).alpha(1).string(),
                    }}
                  />
                </Cell>
                <TextOverflowCell>
                  <Tooltip
                    title={
                      <FullSeriesName seriesName={row.seriesName} groupBy={row.groupBy} />
                    }
                    delay={500}
                    overlayStyle={{maxWidth: '80vw'}}
                  >
                    <TextOverflow>{row.seriesName}</TextOverflow>
                  </Tooltip>
                </TextOverflowCell>
                {totalColumns.map(aggregate => (
                  <NumberCell key={aggregate}>
                    {row[aggregate as keyof typeof row]
                      ? formatMetricUsingUnit(
                          row[aggregate as keyof typeof row] as number | null,
                          row.unit
                        )
                      : '\u2014'}
                  </NumberCell>
                ))}

                {hasActions && (
                  <CenterCell>
                    <ButtonBar gap={0.5}>
                      {row.transaction && (
                        <div>
                          <Tooltip title={t('Open Transaction Summary')}>
                            <LinkButton
                              to={transactionTo(row.transaction)}
                              size="zero"
                              borderless
                            >
                              <IconLightning size="sm" />
                            </LinkButton>
                          </Tooltip>
                        </div>
                      )}

                      {row.release && (
                        <div>
                          <Tooltip title={t('Open Release Details')}>
                            <LinkButton
                              to={releaseTo(row.release)}
                              size="zero"
                              borderless
                            >
                              <IconReleases size="sm" />
                            </LinkButton>
                          </Tooltip>
                        </div>
                      )}

                      {/* do not show add/exclude filter if there's no groupby or if this is an equation */}
                      {Object.keys(row.groupBy ?? {}).length > 0 &&
                        !row.isEquationSeries && (
                          <DropdownMenu
                            items={[
                              {
                                key: 'add-to-filter',
                                label: t('Add to filter'),
                                size: 'sm',
                                onAction: () => {
                                  handleRowFilter(
                                    row.queryIndex,
                                    row,
                                    MetricSeriesFilterUpdateType.ADD
                                  );
                                },
                              },
                              {
                                key: 'exclude-from-filter',
                                label: t('Exclude from filter'),
                                size: 'sm',
                                onAction: () => {
                                  handleRowFilter(
                                    row.queryIndex,
                                    row,
                                    MetricSeriesFilterUpdateType.EXCLUDE
                                  );
                                },
                              },
                            ]}
                            trigger={triggerProps => (
                              <Button
                                {...triggerProps}
                                aria-label={t('Quick Context Action Menu')}
                                data-test-id="quick-context-action-trigger"
                                borderless
                                size="zero"
                                onClick={e => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  triggerProps.onClick?.(e);
                                }}
                                icon={<IconFilter size="sm" />}
                              />
                            )}
                          />
                        )}
                    </ButtonBar>
                  </CenterCell>
                )}

                <PaddingCell />
              </Row>
            </Fragment>
          );
        })}
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

// These aggregates can always be shown as we can calculate them on the frontend
const DEFAULT_TOTALS: MetricAggregation[] = ['avg', 'min', 'max', 'sum'];
// Count and count_unique will always match the sum column
const TOTALS_BLOCKLIST: MetricAggregation[] = ['count', 'count_unique'];

function getTotalColumns(series: Series[]) {
  const totals = new Set<MetricAggregation>();
  series.forEach(({aggregate}) => {
    if (!DEFAULT_TOTALS.includes(aggregate) && !TOTALS_BLOCKLIST.includes(aggregate)) {
      totals.add(aggregate);
    }
  });

  return DEFAULT_TOTALS.concat(Array.from(totals).sort((a, b) => a.localeCompare(b)));
}

function getTotals(series: Series) {
  const {data, total, aggregate} = series;
  if (!data) {
    return {min: null, max: null, avg: null, sum: null};
  }
  const res = data.reduce(
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

  const values: Partial<Record<MetricAggregation, number>> = {
    min: res.min,
    max: res.max,
    sum: res.sum,
    avg: res.sum / res.definedDatapoints,
  };

  values[aggregate] = total;

  return values;
}

const SummaryTableWrapper = styled(`div`)<{
  hasActions: boolean;
  totalColumnsCount: number;
}>`
  display: grid;
  /* padding | color dot | name | avg | min | max | sum | total | actions | padding */
  grid-template-columns:
    ${space(0.75)} ${space(3)} 8fr repeat(
      ${p => (p.hasActions ? p.totalColumnsCount + 1 : p.totalColumnsCount)},
      max-content
    )
    ${space(0.75)};

  max-height: 200px;
  overflow-x: hidden;
  overflow-y: auto;

  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};

  font-size: ${p => p.theme.fontSizeSmall};
`;

const TableBodyWrapper = styled(`div`)<{hasActions: boolean}>`
  display: contents;
`;

const HeaderCell = styled('div')<{disabled?: boolean; right?: boolean}>`
  display: flex;
  flex-direction: row;
  text-transform: uppercase;
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
  align-items: center;
  gap: ${space(0.5)};
  padding: ${space(0.25)} ${space(0.75)};
  line-height: ${p => p.theme.text.lineHeightBody};
  font-weight: ${p => p.theme.fontWeightBold};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.subText};
  user-select: none;

  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: 0;
  border-bottom: 1px solid ${p => p.theme.border};

  top: 0;
  position: sticky;
  z-index: 1;

  &:hover {
    cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  }
`;

const Cell = styled('div')<{right?: boolean}>`
  display: flex;
  padding: ${space(0.25)} ${space(0.75)};
  align-items: center;
  justify-content: flex-start;
  white-space: nowrap;
`;

const NumberCell = styled(Cell)`
  justify-content: flex-end;
  font-variant-numeric: tabular-nums;
`;

const CenterCell = styled(Cell)`
  justify-content: center;
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

const PaddingCell = styled(Cell)`
  padding: 0;
`;

const Row = styled('div')`
  display: contents;
  &:hover {
    cursor: pointer;
    ${Cell}, ${NumberCell}, ${CenterCell}, ${PaddingCell}, ${TextOverflowCell} {
      background-color: ${p => p.theme.bodyBackground};
    }
  }
`;
