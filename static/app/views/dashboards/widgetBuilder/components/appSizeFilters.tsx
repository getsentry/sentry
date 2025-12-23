import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SelectField from 'sentry/components/forms/fields/selectField';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {explodeField} from 'sentry/utils/discover/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

import {SectionHeader} from './common/sectionHeader';

interface AppSizeFilterOptions {
  appIds: Array<{label: string; value: string}>;
  branches: Array<{label: string; value: string}>;
  buildConfigs: Array<{label: string; value: string}>;
}

interface FilterResponse {
  filters: {
    app_ids: string[];
    branches: string[];
    build_configs: string[];
  };
}

interface QueryConfig {
  appIds: string[];
  artifactType: string;
  branch: string;
  buildConfig: string;
  name: string;
}

export function AppSizeFilters() {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  const [sizeType, setSizeType] = useState<'install' | 'download'>('install');
  const [queryConfigs, setQueryConfigs] = useState<QueryConfig[]>(() => {
    const queries = state.query || [];
    if (queries.length === 0) {
      return [
        {
          name: '',
          appIds: [],
          branch: '',
          buildConfig: '',
          artifactType: '',
        },
      ];
    }

    return queries.map((conditions, index) => {
      const parts = conditions.split(/\s+/);
      let appIds: string[] = [];
      let branch = '';
      let buildConfig = '';
      let artifactType = '';

      for (const part of parts) {
        if (part.startsWith('app_id:')) {
          const appIdString = part.substring(7);
          appIds = appIdString ? appIdString.split(',').filter(Boolean) : [];
        } else if (part.startsWith('git_head_ref:')) {
          branch = part.substring(13);
        } else if (part.startsWith('build_configuration_name:')) {
          buildConfig = part.substring(25);
        } else if (part.startsWith('artifact_type:')) {
          artifactType = part.substring(14);
        }
      }

      // Use the query name from state if available
      const widgetQuery = state.queries?.[index];
      const name = widgetQuery?.name || '';

      return {
        name,
        appIds,
        branch,
        buildConfig,
        artifactType,
      };
    });
  });

  // Fetch available filter options from the app-size-stats endpoint
  // Cache for 5 minutes since filter options don't change frequently
  const {data: filterResponse, isPending: loading} = useApiQuery<FilterResponse>(
    [
      `/organizations/${organization.slug}/preprod/app-size-stats/`,
      {query: {includeFilters: 'true', statsPeriod: '90d'}},
    ],
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const filterOptions: AppSizeFilterOptions = {
    appIds:
      filterResponse?.filters?.app_ids?.map((id: string) => ({
        label: id,
        value: id,
      })) ?? [],
    branches:
      filterResponse?.filters?.branches?.map((branch: string) => ({
        label: branch,
        value: branch,
      })) ?? [],
    buildConfigs:
      filterResponse?.filters?.build_configs?.map((config: string) => ({
        label: config,
        value: config,
      })) ?? [],
  };

  // Sync size type from yAxis whenever it changes
  useEffect(() => {
    const yAxis = state.yAxis || [];
    const firstAxis = yAxis[0];
    if (firstAxis && 'field' in firstAxis && firstAxis.field) {
      if (firstAxis.field.includes('download_size')) {
        setSizeType('download');
      } else if (firstAxis.field.includes('install_size')) {
        setSizeType('install');
      }
    }
  }, [state.yAxis]);

  // Build conditions string from a query config
  const buildConditions = useCallback((config: QueryConfig) => {
    const parts: string[] = [];
    if (config.appIds.length > 0) {
      parts.push(`app_id:${config.appIds.join(',')}`);
    }
    if (config.branch) {
      parts.push(`git_head_ref:${config.branch}`);
    }
    if (config.buildConfig) {
      parts.push(`build_configuration_name:${config.buildConfig}`);
    }
    if (config.artifactType) {
      parts.push(`artifact_type:${config.artifactType}`);
    }
    return parts.join(' ');
  }, []);

  // Update all queries in widget state
  const updateQueries = useCallback(
    (configs: QueryConfig[], aggregate?: string) => {
      const conditions = configs.map(buildConditions);

      // Get the current aggregate based on size type
      // Use provided aggregate or fall back to state
      const currentAggregate =
        aggregate || state.yAxis?.[0]?.field || 'max(max_install_size)';

      dispatch({
        type: 'SET_QUERY',
        payload: conditions,
      });

      // Also update the queries array with names
      dispatch({
        type: 'SET_QUERIES',
        payload: configs.map((config, index) => ({
          name: config.name || '',
          conditions: conditions[index] || '',
          fields: [currentAggregate],
          aggregates: [currentAggregate],
          columns: [],
          orderby: '',
        })),
      });
    },
    [buildConditions, dispatch, state.yAxis]
  );

  const handleQueryChange = useCallback(
    (index: number, updates: Partial<QueryConfig>) => {
      const newConfigs = [...queryConfigs];
      newConfigs[index] = {...newConfigs[index], ...updates};
      setQueryConfigs(newConfigs);
      updateQueries(newConfigs);
    },
    [queryConfigs, updateQueries]
  );

  const handleAddQuery = useCallback(() => {
    const newConfigs = [
      ...queryConfigs,
      {
        name: '',
        appIds: [],
        branch: '',
        buildConfig: '',
        artifactType: '',
      },
    ];
    setQueryConfigs(newConfigs);
    updateQueries(newConfigs);
  }, [queryConfigs, updateQueries]);

  const handleRemoveQuery = useCallback(
    (index: number) => {
      if (queryConfigs.length === 1) {
        return; // Don't allow removing the last query
      }
      const newConfigs = queryConfigs.filter((_, i) => i !== index);
      setQueryConfigs(newConfigs);
      updateQueries(newConfigs);
    },
    [queryConfigs, updateQueries]
  );

  const handleSizeTypeChange = useCallback(
    (value: string) => {
      const newSizeType = value as 'install' | 'download';
      setSizeType(newSizeType);

      const newFieldString =
        newSizeType === 'install' ? 'max(max_install_size)' : 'max(max_download_size)';
      const newField = explodeField({field: newFieldString});

      dispatch({
        type: 'SET_Y_AXIS',
        payload: [newField],
      });

      // Update all queries with the new aggregate
      // Pass the new aggregate directly to avoid race conditions with state updates
      updateQueries(queryConfigs, newFieldString);
    },
    [dispatch, queryConfigs, updateQueries]
  );

  if (loading) {
    return (
      <Fragment>
        <SectionHeader
          title={t('Filter')}
          tooltipText={t('Filter app size data by app and platform.')}
        />
        <FiltersContainer>
          <div>{t('Loading filter options...')}</div>
        </FiltersContainer>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <DocsLink href="https://docs.sentry.io/product/size-analysis/">
        {t('Size Analysis documentation')}
      </DocsLink>
      <SectionHeader
        title={t('Filter')}
        tooltipText={t('Filter app size data by app and platform.')}
      />
      <FiltersContainer>
        {queryConfigs.map((config, index) => (
          <QuerySection key={index}>
            <QueryHeader>
              <QueryTitle>{t('Query %s', index + 1)}</QueryTitle>
              {queryConfigs.length > 1 && (
                <Button
                  size="xs"
                  icon={<IconClose />}
                  onClick={() => handleRemoveQuery(index)}
                  aria-label={t('Remove query')}
                />
              )}
            </QueryHeader>
            <SelectField
              name={`appId-${index}`}
              label={t('App ID')}
              placeholder={t('Select one or more apps')}
              value={config.appIds}
              options={filterOptions.appIds}
              onChange={value =>
                handleQueryChange(index, {
                  appIds: Array.isArray(value) ? value : value ? [value] : [],
                })
              }
              inline={false}
              stacked
              clearable
              multiple
            />
            <SelectField
              name={`artifactType-${index}`}
              label={t('Artifact Type')}
              placeholder={t('All artifact types')}
              value={config.artifactType || undefined}
              options={[
                {label: t('xcarchive (.app)'), value: '0'},
                {label: t('aab (Android App Bundle)'), value: '1'},
                {label: t('apk (Android APK)'), value: '2'},
              ]}
              onChange={value => handleQueryChange(index, {artifactType: value || ''})}
              inline={false}
              stacked
              clearable
            />
            <SelectField
              name={`branch-${index}`}
              label={t('Branch')}
              placeholder={t('Select a branch')}
              value={config.branch || undefined}
              options={filterOptions.branches}
              onChange={value => handleQueryChange(index, {branch: value || ''})}
              inline={false}
              stacked
              clearable
            />
            <SelectField
              name={`buildConfig-${index}`}
              label={t('Build Configuration')}
              placeholder={t('Select a build configuration')}
              value={config.buildConfig || undefined}
              options={filterOptions.buildConfigs}
              onChange={value => handleQueryChange(index, {buildConfig: value || ''})}
              inline={false}
              stacked
              clearable
            />
          </QuerySection>
        ))}

        <Button size="sm" onClick={handleAddQuery} icon={<IconAdd />}>
          {t('Add Query')}
        </Button>

        <SizeTypeContainer>
          <RadioGroup
            label={t('Size Type')}
            value={sizeType}
            choices={[
              ['install', t('Install / Uncompressed Size')],
              ['download', t('Download Size')],
            ]}
            onChange={handleSizeTypeChange}
          />
        </SizeTypeContainer>
      </FiltersContainer>
    </Fragment>
  );
}

const DocsLink = styled(ExternalLink)`
  display: block;
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const FiltersContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const QuerySection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const QueryHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const QueryTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const SizeTypeContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
