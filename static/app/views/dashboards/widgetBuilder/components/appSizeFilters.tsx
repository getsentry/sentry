import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SelectField from 'sentry/components/forms/fields/selectField';
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

export function AppSizeFilters() {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedBuildConfig, setSelectedBuildConfig] = useState<string>('');
  const [sizeType, setSizeType] = useState<'install' | 'download'>('install');

  // Use refs to always have the latest values without stale closures
  const selectedAppIdRef = useRef(selectedAppId);
  const selectedBranchRef = useRef(selectedBranch);
  const selectedBuildConfigRef = useRef(selectedBuildConfig);
  const lastDispatchedQueryRef = useRef<string>('');

  // Keep refs in sync with state
  useEffect(() => {
    selectedAppIdRef.current = selectedAppId;
    selectedBranchRef.current = selectedBranch;
    selectedBuildConfigRef.current = selectedBuildConfig;
  }, [selectedAppId, selectedBranch, selectedBuildConfig]);

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

  // Sync local state from query conditions only on initial mount
  // This handles loading saved widgets but doesn't interfere with live updates
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (!isInitialMount.current) {
      return;
    }
    isInitialMount.current = false;

    const conditions = state.query?.[0] ?? '';
    const parts = conditions.split(/\s+/);
    let appId = '';
    let branch = '';
    let buildConfig = '';

    for (const part of parts) {
      if (part.startsWith('app_id:')) {
        appId = part.substring(7);
      } else if (part.startsWith('git_head_ref:')) {
        branch = part.substring(13);
      } else if (part.startsWith('build_configuration_name:')) {
        buildConfig = part.substring(25);
      }
    }

    setSelectedAppId(appId);
    setSelectedBranch(branch);
    setSelectedBuildConfig(buildConfig);

    lastDispatchedQueryRef.current = conditions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync size type from yAxis whenever it changes (e.g., when loading saved widget)
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

  // Build conditions string from filters
  const buildConditions = useCallback(
    (appId: string, branch: string, buildConfig: string) => {
      const parts: string[] = [];
      if (appId) {
        parts.push(`app_id:${appId}`);
      }
      if (branch) {
        parts.push(`git_head_ref:${branch}`);
      }
      if (buildConfig) {
        parts.push(`build_configuration_name:${buildConfig}`);
      }
      return parts.join(' ');
    },
    []
  );

  const handleAppIdChange = useCallback(
    (value: string) => {
      // Handle clearing (empty string or undefined)
      const cleanValue = value || '';
      setSelectedAppId(cleanValue);
      const newConditions = buildConditions(
        cleanValue,
        selectedBranchRef.current,
        selectedBuildConfigRef.current
      );
      lastDispatchedQueryRef.current = newConditions;
      dispatch({
        type: 'SET_QUERY',
        payload: [newConditions],
      });
    },
    [buildConditions, dispatch]
  );

  const handleBranchChange = useCallback(
    (value: string) => {
      // Handle clearing (empty string or undefined)
      const cleanValue = value || '';
      setSelectedBranch(cleanValue);
      const newConditions = buildConditions(
        selectedAppIdRef.current,
        cleanValue,
        selectedBuildConfigRef.current
      );
      lastDispatchedQueryRef.current = newConditions;
      dispatch({
        type: 'SET_QUERY',
        payload: [newConditions],
      });
    },
    [buildConditions, dispatch]
  );

  const handleBuildConfigChange = useCallback(
    (value: string) => {
      // Handle clearing (empty string or undefined)
      const cleanValue = value || '';
      setSelectedBuildConfig(cleanValue);
      const newConditions = buildConditions(
        selectedAppIdRef.current,
        selectedBranchRef.current,
        cleanValue
      );
      lastDispatchedQueryRef.current = newConditions;
      dispatch({
        type: 'SET_QUERY',
        payload: [newConditions],
      });
    },
    [buildConditions, dispatch]
  );

  const handleSizeTypeChange = useCallback(
    (value: string) => {
      const newSizeType = value as 'install' | 'download';
      setSizeType(newSizeType);

      // Update the aggregate field based on size type
      const newFieldString =
        newSizeType === 'install' ? 'max(max_install_size)' : 'max(max_download_size)';

      // Convert string to Column object using explodeField
      const newField = explodeField({field: newFieldString});

      dispatch({
        type: 'SET_Y_AXIS',
        payload: [newField],
      });
    },
    [dispatch]
  );

  if (loading) {
    return (
      <Fragment>
        <SectionHeader
          title={t('Filter')}
          tooltipText={t('Filter app size data by app and branch.')}
        />
        <FiltersContainer>
          <div>{t('Loading filter options...')}</div>
        </FiltersContainer>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <SectionHeader
        title={t('Filter')}
        tooltipText={t('Filter app size data by app and branch.')}
      />
      <FiltersContainer>
        <SelectField
          name="appId"
          label={t('App ID')}
          placeholder={t('Select an app')}
          value={selectedAppId || undefined}
          options={filterOptions.appIds}
          onChange={handleAppIdChange}
          inline={false}
          stacked
          clearable
        />
        <SelectField
          name="branch"
          label={t('Branch')}
          placeholder={t('Select a branch')}
          value={selectedBranch || undefined}
          options={filterOptions.branches}
          onChange={handleBranchChange}
          inline={false}
          stacked
          clearable
        />
        <SelectField
          name="buildConfig"
          label={t('Build Configuration')}
          placeholder={t('Select a build configuration')}
          value={selectedBuildConfig || undefined}
          options={filterOptions.buildConfigs}
          onChange={handleBuildConfigChange}
          inline={false}
          stacked
          clearable
        />
        <SizeTypeContainer>
          <RadioGroup
            label={t('Size Type')}
            value={sizeType}
            choices={[
              ['install', t('Install Size')],
              ['download', t('Download Size')],
            ]}
            onChange={handleSizeTypeChange}
          />
        </SizeTypeContainer>
      </FiltersContainer>
    </Fragment>
  );
}

const FiltersContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const SizeTypeContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
