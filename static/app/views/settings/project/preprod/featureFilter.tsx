import {useCallback, useState} from 'react';

import {Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {useFeatureFilter} from './useFeatureFilter';

const EXAMPLE_BUILDS_COUNT = 5;

interface FeatureFilterProps {
  settingsReadKey: string;
  settingsWriteKey: string;
  successMessage: string;
  title: string;
  children?: React.ReactNode;
}

export function FeatureFilter({
  title,
  successMessage,
  settingsReadKey,
  settingsWriteKey,
  children,
}: FeatureFilterProps) {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const [query, setQuery] = useFeatureFilter(
    project,
    settingsReadKey,
    settingsWriteKey,
    successMessage
  );
  const [localQuery, setLocalQuery] = useState(query);

  const handleQueryChange = useCallback(
    (newQuery: string, state: {queryIsValid: boolean}) => {
      if (state.queryIsValid) {
        setLocalQuery(newQuery);
      }
    },
    []
  );

  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
    },
    [setQuery]
  );

  const queryParams: Record<string, string | number> = {
    per_page: EXAMPLE_BUILDS_COUNT,
    project: project.id,
  };

  if (localQuery) {
    queryParams.query = localQuery;
  }

  const buildsQuery = useApiQuery<BuildDetailsApiResponse[]>(
    [`/organizations/${organization.slug}/builds/`, {query: queryParams}],
    {
      staleTime: 0,
    }
  );

  const builds = buildsQuery.data ?? [];

  return (
    <Panel>
      <PanelHeader>{title}</PanelHeader>
      <PanelBody>
        <Stack gap="lg" style={{padding: '16px'}}>
          {children}
          <Text size="sm" variant="muted">
            {t(
              'Configure a filter to match specific builds. This feature will only apply to new builds that match the filter.'
            )}
          </Text>

          <PreprodSearchBar
            initialQuery={localQuery}
            onChange={handleQueryChange}
            onSearch={handleSearch}
            searchSource="preprod_feature_filter"
            disallowLogicalOperators
            portalTarget={document.body}
          />

          <Text size="sm" variant="muted">
            {t('These recent builds match your current filter criteria.')}
          </Text>

          <PreprodBuildsTable
            builds={builds}
            isLoading={buildsQuery.isLoading}
            error={!!buildsQuery.error}
            organizationSlug={organization.slug}
            hasSearchQuery={!!localQuery}
          />
        </Stack>
      </PanelBody>
    </Panel>
  );
}
