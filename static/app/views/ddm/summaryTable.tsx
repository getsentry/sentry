import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import colorFn from 'color';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconLightning, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getUtcDateString} from 'sentry/utils/dates';
import {formatMetricsUsingUnitAndOp, getNameFromMRI} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {DEFAULT_SORT_STATE} from 'sentry/views/ddm/constants';
import {MetricWidgetDisplayConfig, Series} from 'sentry/views/ddm/widget';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

type SortState = MetricWidgetDisplayConfig['sort'];

export function SummaryTable({
  series,
  operation,
  onRowClick,
  onSortChange,
  sort = DEFAULT_SORT_STATE as SortState,
  setHoveredLegend,
}: {
  onRowClick: (seriesName: string) => void;
  onSortChange: (sortState: SortState) => void;
  series: Series[];
  setHoveredLegend: React.Dispatch<React.SetStateAction<string>> | undefined;
  operation?: string;
  sort?: SortState;
}) {
  const {selection} = usePageFilters();
  const {slug} = useOrganization();

  const hasActions = series.some(s => s.release || s.transaction);

  const router = useRouter();
  const {start, end, statsPeriod, project, environment} = router.location.query;

  const hasMultipleSeries = series.length > 1;

  const changeSort = useCallback(
    (name: SortState['name']) => {
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
    [sort, onSortChange]
  );

  const releaseTo = (release: string) => {
    return {
      pathname: `/organizations/${slug}/releases/${encodeURIComponent(release)}/`,
      query: {
        pageStart: start,
        pageEnd: end,
        pageStatsPeriod: statsPeriod,
        project,
        environment,
      },
    };
  };

  const transactionTo = (transaction: string) =>
    transactionSummaryRouteWithQuery({
      orgSlug: slug,
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
        name: getNameFromMRI(s.seriesName),
      };
    })
    .sort((a, b) => {
      const {name, order} = sort;

      if (name === 'name') {
        return order === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      const aValue = a[name] ?? 0;
      const bValue = b[name] ?? 0;

      return order === 'asc' ? aValue - bValue : bValue - aValue;
    });

  return (
    <SummaryTableWrapper hasActions={hasActions}>
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
      {hasActions && (
        <HeaderCell disabled right>
          {t('Actions')}
        </HeaderCell>
      )}

      {rows.map(
        ({
          name,
          seriesName,
          color,
          hidden,
          unit,
          transaction,
          release,
          avg,
          min,
          max,
          sum,
        }) => {
          return (
            <Fragment key={seriesName}>
              <CellWrapper
                onClick={() => {
                  if (hasMultipleSeries) {
                    onRowClick(seriesName);
                  }
                }}
                onMouseEnter={() => {
                  if (hasMultipleSeries) {
                    setHoveredLegend?.(seriesName);
                  }
                }}
                onMouseLeave={() => {
                  if (hasMultipleSeries) {
                    setHoveredLegend?.('');
                  }
                }}
              >
                <Cell>
                  <ColorDot color={color} isHidden={!!hidden} />
                </Cell>
                <TextOverflowCell>{name}</TextOverflowCell>
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
                          <LinkButton to={transactionTo(transaction)} size="xs">
                            <IconLightning size="xs" />
                          </LinkButton>
                        </Tooltip>
                      </div>
                    )}

                    {release && (
                      <div>
                        <Tooltip title={t('Open Release Details')}>
                          <LinkButton to={releaseTo(release)} size="xs">
                            <IconReleases size="xs" />
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
    </SummaryTableWrapper>
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

  return (
    <HeaderCell
      onClick={() => {
        onClick(name);
      }}
      right={right}
    >
      {sortIcon} {children}
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

      return acc;
    },
    {min: Infinity, max: -Infinity, sum: 0}
  );

  return {...res, avg: res.sum / seriesData.length};
}

// TODO(ddm): PanelTable component proved to be a bit too opinionated for this use case,
// so we're using a custom styled component instead. Figure out what we want to do here
const SummaryTableWrapper = styled(`div`)<{hasActions: boolean}>`
  display: grid;
  grid-template-columns: ${p =>
    p.hasActions ? '24px 8fr repeat(5, 1fr)' : '24px 8fr repeat(4, 1fr)'};
  max-height: 200px;
  overflow-y: auto;
  scrollbar-gutter: stable;
`;

// TODO(ddm): This is a copy of PanelTableHeader, try to figure out how to reuse it
const HeaderCell = styled('div')<{disabled?: boolean; right?: boolean}>`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  line-height: 1;
  display: flex;
  flex-direction: row;
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
  padding: ${space(0.5)} ${space(1)};
  gap: ${space(0.5)};
  user-select: none;

  :hover {
    cursor: ${p => (p.disabled ? 'auto' : 'pointer')};
    background-color: ${p => (p.disabled ? p.theme.background : p.theme.bodyBackground)};
  }
`;

const Cell = styled('div')<{right?: boolean}>`
  display: flex;
  padding: ${space(0.25)} ${space(1)};
  align-items: center;
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
`;

const TextOverflowCell = styled(Cell)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ColorDot = styled(`div`)<{color: string; isHidden: boolean}>`
  background-color: ${p =>
    p.isHidden ? 'transparent' : colorFn(p.color).alpha(1).string()};
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
