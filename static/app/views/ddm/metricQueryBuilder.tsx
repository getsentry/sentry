import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/events/searchBar';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import Tag from 'sentry/components/tag';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricsTag, SavedSearchType, TagCollection} from 'sentry/types';
import {
  defaultMetricDisplayType,
  getReadableMetricType,
  getUseCaseFromMri,
  isAllowedOp,
  MetricDisplayType,
  MetricsQuery,
  useMetricsMeta,
  useMetricsTags,
} from 'sentry/utils/metrics';
import useApi from 'sentry/utils/useApi';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MetricWidgetProps} from 'sentry/views/ddm/metricWidget';

type QueryBuilderProps = {
  displayType: MetricDisplayType; // TODO(ddm): move display type out of the query builder
  metricsQuery: MetricsQuery;
  onChange: (data: Partial<MetricWidgetProps>) => void;
};

export function QueryBuilder({metricsQuery, displayType, onChange}: QueryBuilderProps) {
  const {selection} = usePageFilters();
  const meta = useMetricsMeta(selection.projects);
  const mriModeKeyPressed = useKeyPress('`', undefined, true);
  const [mriMode, setMriMode] = useState(false); // power user mode that shows raw MRI instead of metrics names

  useEffect(() => {
    if (mriModeKeyPressed) {
      setMriMode(!mriMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mriModeKeyPressed]);

  const {data: tags = []} = useMetricsTags(metricsQuery.mri, selection.projects);

  if (!meta) {
    return null;
  }

  return (
    <QueryBuilderWrapper>
      <QueryBuilderRow>
        <WrapPageFilterBar>
          <CompactSelect
            searchable
            triggerProps={{prefix: t('Metric'), size: 'sm'}}
            options={Object.values(meta)
              .filter(metric =>
                mriMode
                  ? true
                  : metric.mri.includes(':custom/') || metric.mri === metricsQuery.mri
              )
              .map(metric => ({
                label: mriMode ? metric.mri : metric.name,
                value: metric.mri,
                trailingItems: mriMode ? undefined : (
                  <Fragment>
                    <Tag tooltipText={t('Type')}>
                      {getReadableMetricType(metric.type)}
                    </Tag>
                    <Tag tooltipText={t('Unit')}>{metric.unit}</Tag>
                  </Fragment>
                ),
              }))}
            value={metricsQuery.mri}
            onChange={option => {
              const availableOps = meta[option.value]?.operations.filter(isAllowedOp);
              const selectedOp = availableOps.includes(metricsQuery.op ?? '')
                ? metricsQuery.op
                : availableOps[0];
              onChange({
                mri: option.value,
                op: selectedOp,
                groupBy: undefined,
                focusedSeries: undefined,
              });
            }}
          />
          <CompactSelect
            triggerProps={{prefix: t('Operation'), size: 'sm'}}
            options={
              meta[metricsQuery.mri]?.operations.filter(isAllowedOp).map(op => ({
                label: op,
                value: op,
              })) ?? []
            }
            disabled={!metricsQuery.mri}
            value={metricsQuery.op}
            onChange={option =>
              onChange({
                op: option.value,
              })
            }
          />
          <CompactSelect
            multiple
            triggerProps={{prefix: t('Group by'), size: 'sm'}}
            options={tags.map(tag => ({
              label: tag.key,
              value: tag.key,
            }))}
            disabled={!metricsQuery.mri}
            value={metricsQuery.groupBy}
            onChange={options =>
              onChange({
                groupBy: options.map(o => o.value),
                focusedSeries: undefined,
              })
            }
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
              onChange({displayType: value});
            }}
          />
        </WrapPageFilterBar>
      </QueryBuilderRow>
      <QueryBuilderRow>
        <MetricSearchBar
          tags={tags}
          mri={metricsQuery.mri}
          disabled={!metricsQuery.mri}
          onChange={query => onChange({query})}
          query={metricsQuery.query}
        />
      </QueryBuilderRow>
    </QueryBuilderWrapper>
  );
}

type MetricSearchBarProps = {
  mri: string;
  onChange: (value: string) => void;
  tags: MetricsTag[];
  disabled?: boolean;
  query?: string;
};

function MetricSearchBar({tags, mri, disabled, onChange, query}: MetricSearchBarProps) {
  const org = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();

  const supportedTags: TagCollection = useMemo(
    () => tags.reduce((acc, tag) => ({...acc, [tag.key]: tag}), {}),
    [tags]
  );

  // TODO(ddm): try to use useApiQuery here
  const getTagValues = useCallback(
    async tag => {
      const tagsValues = await api.requestPromise(
        `/organizations/${org.slug}/metrics/tags/${tag.key}/`,
        {
          query: {
            metric: mri,
            useCase: getUseCaseFromMri(mri),
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
      onClose={handleChange}
      onSearch={handleChange}
      placeholder={t('Filter by tags')}
      defaultQuery={query}
      savedSearchType={SavedSearchType.METRIC}
    />
  );
}

const QueryBuilderWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const QueryBuilderRow = styled('div')`
  padding: ${space(1)};
  padding-bottom: 0;
`;

const WideSearchBar = styled(SearchBar)`
  width: 100%;
  opacity: ${p => (p.disabled ? '0.6' : '1')};
`;

const WrapPageFilterBar = styled(PageFilterBar)`
  height: auto;
  flex-wrap: wrap;
  &:first-child {
    flex-wrap: after;
  }
`;
