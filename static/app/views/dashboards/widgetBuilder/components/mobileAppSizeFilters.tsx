import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SelectField from 'sentry/components/forms/fields/selectField';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {explodeField} from 'sentry/utils/discover/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuildDetailsArtifactType} from 'sentry/views/preprod/types/buildDetailsTypes';

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
  name: string;
  sizeType: 'install' | 'download';
  appId?: string;
  artifactType?: string;
  branch?: string;
  buildConfig?: string;
}

function parseConditionsString(conditions: string): Omit<QueryConfig, 'name'> {
  const params = new URLSearchParams(conditions);

  return {
    appId: params.get('app_id') ?? undefined,
    branch: params.get('git_head_ref') ?? undefined,
    buildConfig: params.get('build_configuration_name') ?? undefined,
    artifactType: params.get('artifact_type') ?? undefined,
    sizeType: (params.get('size_type') as 'install' | 'download') ?? 'install',
  };
}

function buildConditionsString(config: QueryConfig): string {
  const params = new URLSearchParams();

  if (config.appId) {
    params.set('app_id', config.appId);
  }
  if (config.branch) {
    params.set('git_head_ref', config.branch);
  }
  if (config.buildConfig) {
    params.set('build_configuration_name', config.buildConfig);
  }
  if (config.artifactType) {
    params.set('artifact_type', config.artifactType);
  }
  // size_type is client-side only - used to determine which field to request
  // (max_install_size vs max_download_size), but not sent to the API
  if (config.sizeType) {
    params.set('size_type', config.sizeType);
  }

  return params.toString();
}

export function MobileAppSizeFilters() {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  const hasInitialized = useRef(false);
  const [queryConfigs, setQueryConfigs] = useState<QueryConfig[]>(() => {
    const queries = state.query || [];
    if (queries.length === 0) {
      return [
        {
          name: '',
          sizeType: 'install',
        },
      ];
    }

    return queries.map(conditions => ({
      name: '',
      ...parseConditionsString(conditions),
    }));
  });

  const {data: filterResponse, isPending: loading} = useApiQuery<FilterResponse>(
    [
      `/organizations/${organization.slug}/preprod/app-size-stats/`,
      {query: {includeFilters: 'true', statsPeriod: '90d'}},
    ],
    {
      // Cache for 5 minutes since filter options don't change frequently
      staleTime: 5 * 60 * 1000,
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

  const updateQueries = useCallback(
    (configs: QueryConfig[]) => {
      const conditions = configs.map(buildConditionsString);

      dispatch({
        type: 'SET_QUERY',
        payload: conditions,
      });

      // Update Y-axis with the aggregates for each query
      const yAxisFields = configs.map(config => {
        const fieldString =
          config.sizeType === 'install'
            ? 'max(max_install_size)'
            : 'max(max_download_size)';
        return explodeField({field: fieldString});
      });

      dispatch({
        type: 'SET_Y_AXIS',
        payload: yAxisFields,
      });
    },
    [dispatch]
  );

  // Sync initial query config to widget builder context
  useEffect(() => {
    if (!hasInitialized.current && (!state.query || state.query.length === 0)) {
      updateQueries(queryConfigs);
      hasInitialized.current = true;
    }
  }, [state.query, queryConfigs, updateQueries]);

  const handleQueryChange = useCallback(
    (index: number, updates: Partial<QueryConfig>) => {
      const newConfigs = [...queryConfigs];
      newConfigs[index] = {...newConfigs[index], ...updates} as QueryConfig;
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
        sizeType: 'install' as const,
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

  if (loading) {
    return (
      <Fragment>
        <SectionHeader title={t('Filter')} />
        <Flex direction="column" gap="md">
          <div>{t('Loading filter options...')}</div>
        </Flex>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <DocsLink href="https://docs.sentry.io/product/size-analysis/">
        {t('Size Analysis documentation')}
      </DocsLink>
      <SectionHeader title={t('Filter')} />
      <Flex direction="column" gap="md">
        {queryConfigs.map((config, index) => (
          <Container key={index} padding="md" border="primary" radius="md">
            <Flex direction="column" gap="md">
              <Flex justify="between" align="center">
                <Text bold size="md">
                  {t('Query %s', index + 1)}
                </Text>
                {queryConfigs.length > 1 && (
                  <Button
                    size="xs"
                    icon={<IconClose />}
                    onClick={() => handleRemoveQuery(index)}
                    aria-label={t('Remove query')}
                  />
                )}
              </Flex>
              <SelectField
                name={`appId-${index}`}
                label={t('App ID')}
                placeholder={t('Select an app')}
                value={config.appId}
                options={filterOptions.appIds}
                onChange={value => handleQueryChange(index, {appId: value})}
                inline={false}
                stacked
                allowClear
              />
              <SelectField
                name={`artifactType-${index}`}
                label={t('Artifact Type')}
                placeholder={t('All artifact types')}
                value={config.artifactType}
                options={[
                  {
                    label: t('xcarchive (.app)'),
                    value: String(BuildDetailsArtifactType.XCARCHIVE),
                  },
                  {
                    label: t('aab (Android App Bundle)'),
                    value: String(BuildDetailsArtifactType.AAB),
                  },
                  {
                    label: t('apk (Android APK)'),
                    value: String(BuildDetailsArtifactType.APK),
                  },
                ]}
                onChange={value => handleQueryChange(index, {artifactType: value})}
                inline={false}
                stacked
                allowClear
              />
              <SelectField
                name={`branch-${index}`}
                label={t('Branch')}
                placeholder={t('Select a branch')}
                value={config.branch}
                options={filterOptions.branches}
                onChange={value => handleQueryChange(index, {branch: value})}
                inline={false}
                stacked
                allowClear
              />
              <SelectField
                name={`buildConfig-${index}`}
                label={t('Build Configuration')}
                placeholder={t('Select a build configuration')}
                value={config.buildConfig}
                options={filterOptions.buildConfigs}
                onChange={value => handleQueryChange(index, {buildConfig: value})}
                inline={false}
                stacked
                allowClear
              />
              <RadioGroup
                label={t('Size Type')}
                value={config.sizeType}
                choices={[
                  ['install', t('Install / Uncompressed Size')],
                  ['download', t('Download Size')],
                ]}
                onChange={value => {
                  const sizeType = value === 'download' ? 'download' : 'install';
                  handleQueryChange(index, {sizeType});
                }}
              />
            </Flex>
          </Container>
        ))}

        <Button size="sm" onClick={handleAddQuery} icon={<IconAdd />}>
          {t('Add Query')}
        </Button>
      </Flex>
    </Fragment>
  );
}

const DocsLink = styled(ExternalLink)`
  display: block;
  width: fit-content;
  margin-bottom: ${p => p.theme.space.md};
  font-size: ${p => p.theme.fontSize.sm};
`;
