import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import startCase from 'lodash/startCase';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {markLine as createMarkLine} from 'sentry/components/charts/components/markLine';
import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconAdd, IconDelete, IconEdit, IconSearch} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {DataCategoryExact} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {UsageSeries} from 'sentry/views/organizationStats/types';
import type {
  CustomInboundFilter,
  CustomInboundFilterCondition,
} from 'sentry/views/settings/project/projectFilters/customFilterModal';
import {
  customFiltersQueryOptions,
  getCondition,
  getCustomFilterUrl,
  getDataTypeLabel,
  getErrorDetail,
  openCustomFilterModal,
} from 'sentry/views/settings/project/projectFilters/customFilterModal';

// Values a condition shows in the table before the rest fold into a count.
const MAX_VISIBLE_VALUES = 3;

function ValueTag({value}: {value: string}) {
  return (
    <Tag variant="muted">
      <Text monospace size="sm">
        {value}
      </Text>
    </Tag>
  );
}

// One condition of a filter: its property, then the values any of which matches.
function ConditionSummary({condition}: {condition: CustomInboundFilterCondition}) {
  const visible = condition.value.slice(0, MAX_VISIBLE_VALUES);
  const hidden = condition.value.slice(MAX_VISIBLE_VALUES);

  return (
    <Flex wrap="wrap" gap="xs" align="center">
      <Text size="sm" variant="muted">
        {getCondition(condition.type).label}
      </Text>
      {visible.map((value, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <Text size="xs" variant="muted">
              {t('or')}
            </Text>
          )}
          <ValueTag value={value} />
        </Fragment>
      ))}
      {hidden.length > 0 && (
        <Fragment>
          <Text size="xs" variant="muted">
            {t('or')}
          </Text>
          <Tag variant="muted">
            <InfoText
              size="sm"
              title={
                <Stack align="start" gap="xs">
                  {hidden.map((value, index) => (
                    <Text key={index} monospace size="sm">
                      {value}
                    </Text>
                  ))}
                </Stack>
              }
            >
              {tn('%s more', '%s more', hidden.length)}
            </InfoText>
          </Tag>
        </Fragment>
      )}
    </Flex>
  );
}

// Window of the per-row sparkline, matching the chart above the table.
const STATS_PERIOD = '30d';
const STATS_INTERVAL = '1d';
const STATS_FIELD = 'sum(quantity)';

// The trend chart keeps this box whatever a row dropped, so that every row in the
// table lines up. The number beside it centers on the same box.
const CHART_HEIGHT = 36;
const CHART_WIDTH = 160;

// Headroom above the tallest bar of a row, which leaves room for the mark line and
// its label. The chart scales to the row it draws, so the same ratio on every row
// puts every tallest bar at one height. The default axis instead rounds a maximum
// below ten up to ten, which makes a row that dropped five look shorter than a row
// that dropped five hundred.
const CHART_HEADROOM = 1.3;

// Plot area inside the chart box. `containLabel` would size it around the labels of
// the row it draws, which puts the bars of one row at a different height from the
// next. Fixed insets hold the baseline at one height, level with the number beside
// it, and keep the right edge clear for the mark line label.
const CHART_GRID = {top: 6, bottom: 6, left: 0, right: 25, containLabel: false};

// The categories a custom filter drops data in. `error` covers default and security
// events too, which the stats endpoint folds into it. Transactions, replays, and
// profile chunks are here because Relay reads an error's release field on those as
// well, so a release condition drops them alongside errors. Byte categories, such as
// `log_byte`, report the same data a second time in bytes, so counting them would
// multiply what a filter dropped.
const STATS_CATEGORIES = [
  'error',
  'transaction',
  'replay',
  'profile_chunk',
  'span',
  'log_item',
  'trace_metric',
];

// A custom filter reports under this reason in ingest outcomes, followed by its id.
// The backend builds the same string when it sends the filter to Relay.
const OUTCOMES_REASON_PREFIX = 'custom-inbound-filter:';

// What one filter dropped, per data category. A filter drops errors, logs, or trace
// metrics, and each of those counts under its own category in ingest outcomes.
type SeriesByCategory = Map<string, number[]>;

type FilteredStats = {
  intervals: string[];
  seriesByReason: Map<string, SeriesByCategory>;
};

// One request covers the whole table, so index the outcomes by the reason a row
// reports under before the table reads them.
function selectFilteredStats({json}: ApiResponse<UsageSeries>): FilteredStats {
  const seriesByReason = new Map<string, SeriesByCategory>();

  for (const group of json.groups) {
    const reason = String(group.by.reason ?? '');
    const category = String(group.by.category ?? '');
    const byCategory = seriesByReason.get(reason) ?? new Map<string, number[]>();

    byCategory.set(category, group.series[STATS_FIELD] ?? []);
    seriesByReason.set(reason, byCategory);
  }

  return {intervals: json.intervals, seriesByReason};
}

function getCategoryName(category: string): string {
  const info = DATA_CATEGORY_INFO[category as DataCategoryExact];
  return startCase(info?.displayName ?? category);
}

// The categories a filter dropped data in, largest first, so that the tallest one
// sits at the bottom of the stack.
function getCategorySeries(seriesByCategory: SeriesByCategory | undefined) {
  return Array.from(seriesByCategory ?? [], ([category, values]) => ({
    category,
    values,
    total: values.reduce((sum, value) => sum + value, 0),
  }))
    .filter(({total}) => total > 0)
    .sort((a, b) => b.total - a.total);
}

// Renders the trend and the total, one table cell each.
function FilteredVolumeCells({
  intervals,
  seriesByCategory,
  isPending,
  isError,
}: {
  intervals: string[];
  isError: boolean;
  isPending: boolean;
  seriesByCategory: SeriesByCategory | undefined;
}) {
  const theme = useTheme();

  if (isPending) {
    return (
      <Fragment>
        <SimpleTable.RowCell>
          <Placeholder height={`${CHART_HEIGHT}px`} width={`${CHART_WIDTH}px`} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <Flex height={`${CHART_HEIGHT}px`} align="center">
            <Placeholder height="16px" width="40px" />
          </Flex>
        </SimpleTable.RowCell>
      </Fragment>
    );
  }

  if (isError) {
    return (
      <Fragment>
        <SimpleTable.RowCell>
          <Flex height={`${CHART_HEIGHT}px`} align="center">
            <Text variant="muted">{'—'}</Text>
          </Flex>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <Flex height={`${CHART_HEIGHT}px`} align="center">
            <Text variant="muted">{'—'}</Text>
          </Flex>
        </SimpleTable.RowCell>
      </Fragment>
    );
  }

  const categories = getCategorySeries(seriesByCategory);
  const total = categories.reduce(
    (sum, {total: categoryTotal}) => sum + categoryTotal,
    0
  );

  // The mark line sits at the tallest stack, which is higher than any one category.
  // A filter that dropped nothing keeps the empty chart, and shows no mark line.
  const peak = Math.max(
    0,
    ...intervals.map((_, index) =>
      categories.reduce((sum, {values}) => sum + (values[index] ?? 0), 0)
    )
  );

  const markLine = createMarkLine({
    silent: true,
    animation: false,
    lineStyle: {
      color: theme.tokens.border.transparent.neutral.moderate,
      type: [4, 3], // Sets line type to "dashed" with 4 length and 3 gap
      opacity: 0.6,
      cap: 'round', // Rounded edges for the dashes
    },
    data: [{yAxis: peak}],
    label: {
      show: true,
      position: 'end',
      opacity: 1,
      color: theme.tokens.content.secondary,
      fontFamily: 'Rubik',
      fontSize: 10,
      formatter: formatAbbreviatedNumber(peak),
    },
  });

  const colors = theme.chart.getColorPalette(Math.max(categories.length, 1));

  const series = categories.length
    ? categories.map(({category, values}, index) => ({
        seriesName: getCategoryName(category),
        markLine: index === 0 && peak > 0 ? markLine : undefined,
        data: intervals.map((name, i) => ({name, value: values[i] ?? 0})),
      }))
    : [
        {
          seriesName: t('Filtered'),
          data: intervals.map(name => ({name, value: 0})),
        },
      ];

  return (
    <Fragment>
      <SimpleTable.RowCell>
        <Container
          width={`${CHART_WIDTH}px`}
          height={`${CHART_HEIGHT}px`}
          role="img"
          aria-label={t('Filtered volume trend, peak %s', formatAbbreviatedNumber(peak))}
        >
          <MiniBarChart
            stacked
            animateBars
            showXAxisLine
            showMarkLineLabel
            hideZeros
            isGroupedByDate
            showTimeInTooltip
            height={CHART_HEIGHT}
            barOpacity={1}
            hideDelay={50}
            markLineLabelSide="right"
            grid={CHART_GRID}
            colors={colors}
            tooltip={{appendToBody: true}}
            yAxisMax={peak > 0 ? peak * CHART_HEADROOM : undefined}
            series={series}
          />
        </Container>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Flex height={`${CHART_HEIGHT}px`} align="center">
          <Text tabular variant={total === 0 ? 'muted' : 'primary'}>
            {formatAbbreviatedNumber(total)}
          </Text>
        </Flex>
      </SimpleTable.RowCell>
    </Fragment>
  );
}

function matchesQuery(filter: CustomInboundFilter, query: string) {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  const haystack = [
    filter.name ?? '',
    getDataTypeLabel(filter),
    ...filter.conditions.flatMap(condition => [
      getCondition(condition.type).label,
      ...condition.value,
    ]),
  ];
  return haystack.some(field => field.toLowerCase().includes(needle));
}

export function CustomFilters({project}: {project: Project}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');

  const hasWriteAccess = hasEveryAccess(['project:write'], {
    organization,
    project,
  });
  const queryOptions = customFiltersQueryOptions(organization, project);
  const {queryKey} = queryOptions;

  const {data: filters = [], isPending, isError, refetch} = useQuery(queryOptions);

  const {
    data: stats,
    isPending: isStatsPending,
    isError: isStatsError,
  } = useQuery({
    ...apiOptions.as<UsageSeries>()('/organizations/$organizationIdOrSlug/stats_v2/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        project: project.id,
        outcome: 'filtered',
        field: STATS_FIELD,
        category: STATS_CATEGORIES,
        groupBy: ['reason', 'category'],
        interval: STATS_INTERVAL,
        statsPeriod: STATS_PERIOD,
      },
      staleTime: Infinity,
    }),
    select: selectFilteredStats,
  });

  const invalidate = () => queryClient.invalidateQueries({queryKey});

  const toggleMutation = useMutation({
    mutationFn: (filter: CustomInboundFilter) =>
      fetchMutation<CustomInboundFilter>({
        method: 'PUT',
        url: getCustomFilterUrl(organization, project, filter.id),
        data: {active: !filter.active},
      }),
    onSuccess: () => invalidate(),
    onError: error => {
      addErrorMessage(getErrorDetail(error, t('Unable to update filter')));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchMutation({
        method: 'DELETE',
        url: getCustomFilterUrl(organization, project, id),
      }),
    onSuccess: () => {
      addSuccessMessage(t('Filter deleted'));
      invalidate();
    },
    onError: error => {
      addErrorMessage(getErrorDetail(error, t('Unable to delete filter')));
    },
  });

  const handleToggleActive = (filter: CustomInboundFilter) =>
    toggleMutation.mutate(filter);

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const visibleFilters = filters.filter(filter => matchesQuery(filter, query));

  return (
    <Stack gap="lg">
      <Heading as="h2" size="md">
        {t('Filter Rules')}
      </Heading>
      <Flex gap="md" align="center">
        <Flex flex={1}>
          <InputGroup style={{width: '100%'}}>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch size="sm" />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              size="sm"
              aria-label={t('Search rules')}
              placeholder={t('Search rules')}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </InputGroup>
        </Flex>
        <Button
          size="sm"
          variant="primary"
          icon={<IconAdd />}
          disabled={!hasWriteAccess}
          tooltipProps={
            hasWriteAccess
              ? undefined
              : {title: t('You need project write access to add filters.')}
          }
          onClick={() => openCustomFilterModal({project})}
        >
          {t('Add Filter')}
        </Button>
      </Flex>

      {isError ? (
        <LoadingError onRetry={refetch} />
      ) : isPending ? (
        <LoadingIndicator />
      ) : (
        <Container containerType="inline-size">
          <CustomFiltersTable columns={CUSTOM_FILTER_COLUMNS} customSections scrollable>
            <SimpleTable.Head sticky>
              <SimpleTable.HeaderRow>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Active')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Name')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Data Type')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Conditions')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Trend')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Filtered')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Created')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Edited')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Action')}
                </SimpleTable.HeaderCell>
              </SimpleTable.HeaderRow>
            </SimpleTable.Head>
            <SimpleTable.Body>
              {visibleFilters.length === 0 && (
                <SimpleTable.Empty>
                  {filters.length === 0
                    ? t('No inbound filters found')
                    : t('No rules match your search')}
                </SimpleTable.Empty>
              )}
              {visibleFilters.map(filter => (
                <SimpleTable.Row
                  key={filter.id}
                  variant={filter.active ? 'default' : 'faded'}
                >
                  <SimpleTable.RowCell>
                    <Switch
                      aria-label={
                        filter.active ? t('Disable filter') : t('Enable filter')
                      }
                      checked={filter.active}
                      disabled={!hasWriteAccess}
                      onChange={() => handleToggleActive(filter)}
                    />
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <InfoText mode="overflowOnly" title={filter.name}>
                      {filter.name}
                    </InfoText>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Text ellipsis variant="muted">
                      {getDataTypeLabel(filter)}
                    </Text>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Stack align="start" gap="xs">
                      {filter.conditions.map((condition, index) => (
                        <ConditionSummary key={index} condition={condition} />
                      ))}
                    </Stack>
                  </SimpleTable.RowCell>
                  <FilteredVolumeCells
                    intervals={stats?.intervals ?? []}
                    seriesByCategory={stats?.seriesByReason.get(
                      `${OUTCOMES_REASON_PREFIX}${filter.id}`
                    )}
                    isPending={isStatsPending}
                    isError={isStatsError}
                  />
                  <SimpleTable.RowCell whiteSpace="nowrap">
                    <TimeSince date={filter.dateCreated} unitStyle="extraShort" />
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell whiteSpace="nowrap">
                    <TimeSince date={filter.dateUpdated} unitStyle="extraShort" />
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Flex gap="sm">
                      <Button
                        size="sm"
                        variant="transparent"
                        icon={<IconEdit />}
                        aria-label={t('Edit filter')}
                        disabled={!hasWriteAccess}
                        onClick={() => openCustomFilterModal({project, filter})}
                      />
                      <Confirm
                        priority="danger"
                        disabled={!hasWriteAccess}
                        message={t('Are you sure you want to delete this filter?')}
                        onConfirm={() => handleDelete(filter.id)}
                      >
                        <Button
                          size="sm"
                          variant="transparent"
                          icon={<IconDelete />}
                          aria-label={t('Delete filter')}
                        />
                      </Confirm>
                    </Flex>
                  </SimpleTable.RowCell>
                </SimpleTable.Row>
              ))}
            </SimpleTable.Body>
          </CustomFiltersTable>
        </Container>
      )}
    </Stack>
  );
}

// A column joins the table only once the conditions still have room to read at that
// width. The dates need the most room, so they go first as the table narrows, then
// the trend, then the total.
const CUSTOM_FILTER_COLUMNS: TableColumnConfig[] = [
  {key: 'active', width: '90px'},
  {key: 'name', width: 'minmax(160px, 1fr)'},
  {key: 'dataType', width: '120px'},
  {key: 'conditions', width: 'minmax(240px, 2fr)'},
  {key: 'trend', visible: {'3xl': true}, width: '190px'},
  {key: 'filtered', visible: {'2xl': true}, width: '90px'},
  {key: 'created', visible: {'5xl': true}, width: '90px'},
  {key: 'edited', visible: {'5xl': true}, width: '90px'},
  {key: 'action', width: '110px'},
];

// A fixed height keeps the search box and the sections below the table in place
// while a search shrinks or grows the list. The grid would otherwise stretch its
// rows to fill the spare height.
const CustomFiltersTable = styled(SimpleTable)`
  height: 480px;
  align-content: start;
`;
