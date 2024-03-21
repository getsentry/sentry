import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import colorFn from 'color';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconFilter, IconLightning, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {DEFAULT_SORT_STATE} from 'sentry/utils/metrics/constants';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
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
  onRowHover,
  onRowFilter,
}: {
  onRowClick: (series: FocusedMetricsSeries) => void;
  onSortChange: (sortState: SortState) => void;
  series: Series[];
  onColorDotClick?: (series: FocusedMetricsSeries) => void;
  onRowFilter?: (index: number, series: FocusedMetricsSeries) => void;
  onRowHover?: (seriesName: string) => void;
  sort?: SortState;
}) {
  const {selection} = usePageFilters();
  const organization = useOrganization();

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
    (index: number | undefined, row: FocusedMetricsSeries) => {
      if (index === undefined) {
        return;
      }
      trackAnalytics('ddm.widget.add_row_filter', {
        organization,
      });
      onRowFilter?.(index, row);
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
        ...getValues(s.data),
      };
    })
    // Filter series with no data
    .filter(s => s.min !== Infinity)
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
      <HeaderCell disabled />
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
      <SortableHeaderCell onClick={changeSort} sortState={sort} name="total" right>
        {t('Total')}
      </SortableHeaderCell>
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
        {rows.map(
          ({
            seriesName,
            id,
            groupBy,
            color,
            hidden,
            unit,
            transaction,
            release,
            avg,
            min,
            max,
            sum,
            total,
            isEquationSeries,
            queryIndex,
          }) => {
            return (
              <Fragment key={id}>
                <Row
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
                      onRowHover?.(id);
                    }
                  }}
                >
                  <PaddingCell />
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
                  <NumberCell>{formatMetricUsingUnit(avg, unit)}</NumberCell>
                  <NumberCell>{formatMetricUsingUnit(min, unit)}</NumberCell>
                  <NumberCell>{formatMetricUsingUnit(max, unit)}</NumberCell>
                  <NumberCell>{formatMetricUsingUnit(sum, unit)}</NumberCell>
                  <NumberCell>{formatMetricUsingUnit(total, unit)}</NumberCell>

                  {hasActions && (
                    <CenterCell>
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

                        <Tooltip title={t('Add to Filter')} disabled={isEquationSeries}>
                          <Button
                            disabled={isEquationSeries}
                            onClick={event => {
                              event.stopPropagation();

                              handleRowFilter(queryIndex, {
                                id,
                                groupBy,
                              });
                            }}
                            size="zero"
                            borderless
                          >
                            <IconFilter size="sm" />
                          </Button>
                        </Tooltip>
                      </ButtonBar>
                    </CenterCell>
                  )}

                  <PaddingCell />
                </Row>
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
  /* padding | color dot | name | avg | min | max | sum | total | actions | padding */
  grid-template-columns:
    ${space(0.75)} ${space(3)} 8fr repeat(${p => (p.hasActions ? 6 : 5)}, max-content)
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
  font-weight: 600;
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
