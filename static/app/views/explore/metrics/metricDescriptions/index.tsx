import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {CursorHandler} from '@sentry/scraps/pagination';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {openModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconArrow, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getFormattedDate} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {decodeScalar} from 'sentry/utils/queryString';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EditMetricDescriptionModal} from 'sentry/views/explore/metrics/metricDescriptions/editMetricDescriptionModal';
import type {TraceMetricListItem} from 'sentry/views/explore/metrics/metricDescriptions/types';
import {useMetricDescriptionsQueryOptions} from 'sentry/views/explore/metrics/metricDescriptions/useMetricDescriptions';
import {
  isTraceMetricTypeValue,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';
import {makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import {TopBar} from 'sentry/views/navigation/topBar';

const METRIC_TYPE_OPTIONS: Array<{label: string; value: TraceMetricTypeValue | ''}> = [
  {label: t('All types'), value: ''},
  {label: t('Counter'), value: 'counter'},
  {label: t('Gauge'), value: 'gauge'},
  {label: t('Distribution'), value: 'distribution'},
];

const PAGE_TITLE = t('Metric Descriptions');

export default function MetricDescriptionsContent() {
  const organization = useOrganization();
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.TRACE_METRICS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <Feature
      features={['data-browsing-attribute-context']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={PAGE_TITLE} orgSlug={organization.slug}>
        <PageFiltersContainer
          maxPickableDays={datePageFilterProps.maxPickableDays}
          defaultSelection={
            datePageFilterProps.defaultPeriod
              ? {
                  datetime: {
                    period: datePageFilterProps.defaultPeriod,
                    start: null,
                    end: null,
                    utc: null,
                  },
                }
              : undefined
          }
        >
          <TopBar.Slot name="title">{PAGE_TITLE}</TopBar.Slot>
          <MetricDescriptionsBody datePageFilterProps={datePageFilterProps} />
        </PageFiltersContainer>
      </SentryDocumentTitle>
    </Feature>
  );
}

interface MetricDescriptionsBodyProps {
  datePageFilterProps: ReturnType<typeof useDatePageFilterProps>;
}

function MetricDescriptionsBody({datePageFilterProps}: MetricDescriptionsBodyProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const search = decodeScalar(location.query.query, '');
  const typeParam = decodeScalar(location.query.type, '');
  const type = isTraceMetricTypeValue(typeParam) ? typeParam : undefined;
  const cursor = decodeScalar(location.query.cursor);

  const {
    data,
    isPending,
    isError,
    refetch: refetchQuery,
  } = useQuery({
    ...useMetricDescriptionsQueryOptions({search, type, cursor}),
    select: selectJsonWithHeaders,
  });

  const metrics = data?.json ?? [];
  const pageLinks = data?.headers?.Link ?? null;

  // Filter and search changes reset pagination to the first page.
  const updateQuery = (updates: Record<string, string | undefined>) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, ...updates},
    });
  };

  const handleCursor: CursorHandler = (nextCursor, path, query) => {
    navigate({pathname: path, query: {...query, cursor: nextCursor}});
  };

  const openEditModal = (metric: TraceMetricListItem) => {
    openModal(deps => (
      <EditMetricDescriptionModal {...deps} metric={metric} onSuccess={refetchQuery} />
    ));
  };

  return (
    <BodyContainer>
      <LinkButton
        icon={<IconArrow direction="left" />}
        size="sm"
        to={makeMetricsPathname({organizationSlug: organization.slug, path: '/'})}
      >
        {t('Back to metrics')}
      </LinkButton>

      <FilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter {...datePageFilterProps} />
        <CompactSelect
          value={type ?? ''}
          options={METRIC_TYPE_OPTIONS}
          onChange={option => updateQuery({type: option.value || undefined})}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Type')} />
          )}
        />
        <SearchWrapper>
          <SearchBar
            defaultQuery={search}
            placeholder={t('Search by metric name')}
            onSearch={value => updateQuery({query: value || undefined})}
          />
        </SearchWrapper>
      </FilterBar>

      <StyledSimpleTable data-test-id="metric-descriptions-table">
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>{t('Metric')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Type')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Brief')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Additional context')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Last seen')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.Header>

        {isError ? (
          <SimpleTable.Empty>{t('Unable to load metrics.')}</SimpleTable.Empty>
        ) : isPending ? (
          <SimpleTable.Empty>{t('Loading…')}</SimpleTable.Empty>
        ) : metrics.length === 0 ? (
          <SimpleTable.Empty>{t('No metrics found.')}</SimpleTable.Empty>
        ) : (
          metrics.map(metric => (
            <SimpleTable.Row key={`${metric.name}:${metric.type}`}>
              <SimpleTable.RowCell>
                <Text bold monospace>
                  {metric.name}
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text>
                  {metric.type}
                  {metric.unit ? ` (${metric.unit})` : ''}
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                {metric.context?.brief ? (
                  <Text>{metric.context.brief}</Text>
                ) : (
                  <Text variant="muted">{t('No description')}</Text>
                )}
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                {metric.context?.additionalContext ? (
                  <Text>{metric.context.additionalContext}</Text>
                ) : (
                  <Text variant="muted">{'—'}</Text>
                )}
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text variant="muted">
                  {defined(metric.lastSeen)
                    ? // `lastSeen` is max(timestamp_precise) in nanoseconds;
                      // convert to milliseconds for date formatting.
                      getFormattedDate(metric.lastSeen / 1_000_000, 'lll')
                    : '—'}
                </Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Button
                  size="xs"
                  icon={<IconEdit />}
                  aria-label={t('Edit description for %s', metric.name)}
                  onClick={() => openEditModal(metric)}
                >
                  {t('Edit')}
                </Button>
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))
        )}
      </StyledSimpleTable>

      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </BodyContainer>
  );
}

const BodyContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space['2xl']};
`;

const FilterBar = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.md};
  align-items: center;
`;

const SearchWrapper = styled('div')`
  flex: 1;
  min-width: 240px;
`;

const StyledSimpleTable = styled(SimpleTable)`
  grid-template-columns:
    minmax(160px, 1.2fr) max-content minmax(160px, 1.5fr)
    minmax(160px, 1.5fr) max-content max-content;
`;
