import {Fragment, memo, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import {HeaderTitle} from 'sentry/components/charts/styles';
import {CompactSelect} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {BooleanOperator} from 'sentry/components/searchSyntax/parser';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import Tag from 'sentry/components/tag';
import TextOverflow from 'sentry/components/textOverflow';
import {IconLightning, IconReleases, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricMeta, MRI, SavedSearchType, TagCollection} from 'sentry/types';
import {
  defaultMetricDisplayType,
  getReadableMetricType,
  isAllowedOp,
  isCustomMetric,
  isMeasurement,
  isTransactionDuration,
  MetricDisplayType,
  MetricsQuery,
  MetricsQuerySubject,
  MetricWidgetQueryParams,
  stringifyMetricWidget,
} from 'sentry/utils/metrics';
import {formatMRI, getUseCaseFromMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import useApi from 'sentry/utils/useApi';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

type QueryBuilderProps = {
  displayType: MetricDisplayType;
  isEdit: boolean;
  // TODO(ddm): move display type out of the query builder
  metricsQuery: MetricsQuerySubject;
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
  projects: number[];
  powerUserMode?: boolean;
};

const isShownByDefault = (metric: MetricMeta) =>
  isMeasurement(metric) || isCustomMetric(metric) || isTransactionDuration(metric);

function stopPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

export const QueryBuilder = memo(function QueryBuilder({
  metricsQuery,
  projects,
  displayType,
  powerUserMode,
  onChange,
  isEdit,
}: QueryBuilderProps) {
  const {data: meta, isLoading: isMetaLoading} = useMetricsMeta(projects);
  const router = useRouter();
  const mriModeKeyPressed = useKeyPress('`', undefined, true);
  const [mriMode, setMriMode] = useState(powerUserMode); // power user mode that shows raw MRI instead of metrics names

  useEffect(() => {
    if (mriModeKeyPressed && !powerUserMode) {
      setMriMode(!mriMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mriModeKeyPressed, powerUserMode]);

  const {data: tags = []} = useMetricsTags(metricsQuery.mri, projects);

  const displayedMetrics = useMemo(() => {
    if (mriMode) {
      return meta;
    }

    const isSelected = (metric: MetricMeta) => metric.mri === metricsQuery.mri;
    return meta
      .filter(metric => isShownByDefault(metric) || isSelected(metric))
      .sort(metric => (isSelected(metric) ? -1 : 1));
  }, [meta, metricsQuery.mri, mriMode]);

  const selectedMeta = useMemo(() => {
    return meta.find(metric => metric.mri === metricsQuery.mri);
  }, [meta, metricsQuery.mri]);

  // Reset the query data if the selected metric is no longer available
  useEffect(() => {
    if (
      metricsQuery.mri &&
      !isMetaLoading &&
      !displayedMetrics.find(metric => metric.mri === metricsQuery.mri)
    ) {
      onChange({mri: '' as MRI, op: '', groupBy: []});
    }
  }, [isMetaLoading, displayedMetrics, metricsQuery.mri, onChange]);

  const stringifiedMetricWidget = stringifyMetricWidget(metricsQuery);

  const readableType = getReadableMetricType(parseMRI(metricsQuery.mri)?.type);

  if (!isEdit) {
    return (
      <QueryBuilderWrapper>
        <WidgetTitle>
          <TextOverflow>{metricsQuery.title || stringifiedMetricWidget}</TextOverflow>
        </WidgetTitle>
      </QueryBuilderWrapper>
    );
  }

  return (
    <QueryBuilderWrapper>
      <QueryBuilderRow>
        <WrapPageFilterBar>
          <CompactSelect
            searchable
            sizeLimit={100}
            triggerProps={{prefix: t('Metric'), size: 'sm'}}
            options={displayedMetrics.map(metric => ({
              label: mriMode ? metric.mri : formatMRI(metric.mri),
              // enable search by mri, name, unit (millisecond), type (c:), and readable type (counter)
              textValue: `${metric.mri}${getReadableMetricType(metric.type)}`,
              value: metric.mri,
              trailingItems: mriMode
                ? undefined
                : ({isFocused}) => (
                    <Fragment>
                      {isFocused && isCustomMetric({mri: metric.mri}) && (
                        <Button
                          borderless
                          size="zero"
                          icon={<IconSettings />}
                          aria-label={t('Metric Settings')}
                          onPointerDown={() => {
                            // not using onClick to beat the dropdown listener
                            navigateTo(
                              `/settings/projects/:projectId/metrics/${encodeURIComponent(
                                metric.mri
                              )}`,
                              router
                            );
                          }}
                        />
                      )}

                      <Tag tooltipText={t('Type')}>
                        {getReadableMetricType(metric.type)}
                      </Tag>
                      <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
                    </Fragment>
                  ),
            }))}
            value={metricsQuery.mri}
            onChange={option => {
              const availableOps =
                meta
                  .find(metric => metric.mri === option.value)
                  ?.operations.filter(isAllowedOp) ?? [];

              // @ts-expect-error .op is an operation
              const selectedOp = availableOps.includes(metricsQuery.op ?? '')
                ? metricsQuery.op
                : availableOps?.[0];
              Sentry.metrics.increment('ddm.widget.metric', 1, {
                tags: {
                  display: displayType ?? defaultMetricDisplayType,
                  type: readableType,
                  operation: selectedOp,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                mri: option.value,
                op: selectedOp,
                groupBy: undefined,
                focusedSeries: undefined,
                displayType: getWidgetDisplayType(option.value, selectedOp),
              });
            }}
          />
          <CompactSelect
            triggerProps={{prefix: t('Op'), size: 'sm'}}
            options={
              selectedMeta?.operations.filter(isAllowedOp).map(op => ({
                label: op,
                value: op,
              })) ?? []
            }
            disabled={!metricsQuery.mri}
            value={metricsQuery.op}
            onChange={option => {
              Sentry.metrics.increment('ddm.widget.operation', 1, {
                tags: {
                  display: displayType ?? defaultMetricDisplayType,
                  type: readableType,
                  operation: option.value,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                op: option.value,
              });
            }}
          />
          <CompactSelect
            multiple
            triggerProps={{prefix: t('Group by'), size: 'sm'}}
            options={tags.map(tag => ({
              label: tag.key,
              value: tag.key,
              trailingItems: (
                <Fragment>
                  {tag.key === 'release' && <IconReleases size="xs" />}
                  {tag.key === 'transaction' && <IconLightning size="xs" />}
                </Fragment>
              ),
            }))}
            disabled={!metricsQuery.mri}
            value={metricsQuery.groupBy}
            onChange={options => {
              Sentry.metrics.increment('ddm.widget.group', 1, {
                tags: {
                  display: displayType ?? defaultMetricDisplayType,
                  type: readableType,
                  operation: metricsQuery.op,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({
                groupBy: options.map(o => o.value),
                focusedSeries: undefined,
              });
            }}
          />
          <CompactSelect
            triggerProps={{prefix: t('Display'), size: 'sm'}}
            value={displayType ?? defaultMetricDisplayType}
            options={[
              {
                value: MetricDisplayType.LINE,
                label: t('Line'),
              },
              {
                value: MetricDisplayType.AREA,
                label: t('Area'),
              },
              {
                value: MetricDisplayType.BAR,
                label: t('Bar'),
              },
            ]}
            onChange={({value}) => {
              Sentry.metrics.increment('ddm.widget.display', 1, {
                tags: {
                  display: value,
                  type: readableType,
                  operation: metricsQuery.op,
                  isGrouped: !!metricsQuery.groupBy?.length,
                  isFiltered: !!metricsQuery.query,
                },
              });
              onChange({displayType: value});
            }}
          />
        </WrapPageFilterBar>
      </QueryBuilderRow>
      {/* Stop propagation so widget does not get selected immediately */}
      <QueryBuilderRow onClick={stopPropagation}>
        <MetricSearchBar
          // TODO(aknaus): clean up projectId type in ddm
          projectIds={projects.map(id => id.toString())}
          mri={metricsQuery.mri}
          disabled={!metricsQuery.mri}
          onChange={query => {
            Sentry.metrics.increment('ddm.widget.filter', 1, {
              tags: {
                display: displayType ?? defaultMetricDisplayType,
                type: readableType,
                operation: metricsQuery.op,
                isGrouped: !!metricsQuery.groupBy?.length,
                isFiltered: !!query,
              },
            });
            onChange({query});
          }}
          query={metricsQuery.query}
        />
      </QueryBuilderRow>
    </QueryBuilderWrapper>
  );
});

interface MetricSearchBarProps extends Partial<SmartSearchBarProps> {
  onChange: (value: string) => void;
  projectIds: string[];
  disabled?: boolean;
  mri?: MRI;
  query?: string;
}

const EMPTY_ARRAY = [];
const EMPTY_SET = new Set<never>();
const DISSALLOWED_LOGICAL_OPERATORS = new Set([BooleanOperator.OR]);

export function MetricSearchBar({
  mri,
  disabled,
  onChange,
  query,
  projectIds,
  ...props
}: MetricSearchBarProps) {
  const org = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();
  const projectIdNumbers = useMemo(
    () => projectIds.map(id => parseInt(id, 10)),
    [projectIds]
  );

  const {data: tags = EMPTY_ARRAY, isLoading} = useMetricsTags(mri, projectIdNumbers);

  const supportedTags: TagCollection = useMemo(
    () => tags.reduce((acc, tag) => ({...acc, [tag.key]: tag}), {}),
    [tags]
  );

  // TODO(ddm): try to use useApiQuery here
  const getTagValues = useCallback(
    async tag => {
      const useCase = getUseCaseFromMRI(mri);
      const tagsValues = await api.requestPromise(
        `/organizations/${org.slug}/metrics/tags/${tag.key}/`,
        {
          query: {
            metric: mri,
            useCase,
            project: selection.projects,
          },
        }
      );

      return tagsValues.filter(tv => tv.value !== '').map(tv => tv.value);
    },
    [api, mri, org.slug, selection.projects]
  );

  const handleChange = useCallback(
    (value: string, {validSearch} = {validSearch: true}) => {
      if (validSearch) {
        onChange(value);
      }
    },
    [onChange]
  );

  return (
    <WideSearchBar
      disabled={disabled}
      maxMenuHeight={220}
      organization={org}
      onGetTagValues={getTagValues}
      supportedTags={supportedTags}
      // don't highlight tags while loading as we don't know yet if they are supported
      highlightUnsupportedTags={!isLoading}
      disallowedLogicalOperators={DISSALLOWED_LOGICAL_OPERATORS}
      disallowFreeText
      onClose={handleChange}
      onSearch={handleChange}
      placeholder={t('Filter by tags')}
      query={query}
      savedSearchType={SavedSearchType.METRIC}
      durationKeys={EMPTY_SET}
      percentageKeys={EMPTY_SET}
      numericKeys={EMPTY_SET}
      dateKeys={EMPTY_SET}
      booleanKeys={EMPTY_SET}
      sizeKeys={EMPTY_SET}
      textOperatorKeys={EMPTY_SET}
      {...props}
    />
  );
}

function getWidgetDisplayType(
  mri: MetricsQuery['mri'],
  op: MetricsQuery['op']
): MetricDisplayType {
  if (mri?.startsWith('c') || op === 'count') {
    return MetricDisplayType.BAR;
  }
  return MetricDisplayType.LINE;
}

const QueryBuilderWrapper = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
`;

const QueryBuilderRow = styled('div')`
  padding: ${space(1)};
  padding-bottom: 0;
`;

const WideSearchBar = styled(SmartSearchBar)`
  width: 100%;
  opacity: ${p => (p.disabled ? '0.6' : '1')};
`;

const WrapPageFilterBar = styled(PageFilterBar)`
  max-width: max-content;
  height: auto;
  flex-wrap: wrap;
`;

const WidgetTitle = styled(HeaderTitle)`
  padding-left: ${space(2)};
  padding-top: ${space(1.5)};
  padding-right: ${space(1)};
`;
