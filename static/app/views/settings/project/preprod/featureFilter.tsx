import {useCallback, useState} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {PreprodBuildsTable} from 'sentry/components/preprod/preprodBuildsTable';
import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {useFeatureFilter, type PreprodEnabledWriteKey} from './useFeatureFilter';

const EXAMPLE_BUILDS_COUNT = 5;
const FEATURE_FILTER_ALLOWED_KEYS = [
  'app_id',
  'app_name',
  'build_configuration_name',
  'platform_name',
  'build_number',
  'build_version',
  'git_head_ref',
  'git_base_ref',
  'git_head_sha',
  'git_base_sha',
  'git_head_repo_name',
  'git_pr_number',
];

interface FeatureFilterProps {
  docsUrl: string;
  enabledReadKey: string;
  enabledWriteKey: PreprodEnabledWriteKey;
  queryReadKey: string;
  queryWriteKey: string;
  successMessage: string;
  title: string;
  display?: PreprodBuildsDisplay;
}

export function FeatureFilter({
  title,
  successMessage,
  queryReadKey,
  queryWriteKey,
  enabledReadKey,
  enabledWriteKey,
  docsUrl,
  display,
}: FeatureFilterProps) {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {filterQuery, setFilterQuery, enabled, setEnabled} = useFeatureFilter({
    project,
    queryReadKey,
    queryWriteKey,
    enabledReadKey,
    enabledWriteKey,
    successMessage,
  });
  const [localQuery, setLocalQuery] = useState(filterQuery);

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
      setFilterQuery(newQuery);
    },
    [setFilterQuery]
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
      enabled,
    }
  );

  const builds = buildsQuery.data ?? [];

  return (
    <Panel>
      <PanelHeader>
        <Flex align="center" gap="xs">
          {t('%s - Configuration', title)}
          <PageHeadingQuestionTooltip
            docsUrl={docsUrl}
            title={t('Learn more about configuring build filters.')}
          />
        </Flex>
      </PanelHeader>
      <PanelBody>
        <Flex align="center" justify="between" padding="xl" borderBottom="primary">
          <Stack gap="xs">
            <Text size="lg" bold>
              {t('%s Enabled', title)}
            </Text>
            <Text size="sm" variant="muted">
              {t('Enable or disable %s for this project.', title.toLowerCase())}
            </Text>
          </Stack>
          <Switch
            size="lg"
            checked={enabled}
            onChange={() => setEnabled(!enabled)}
            aria-label={t('Toggle %s', title.toLowerCase())}
          />
        </Flex>

        {enabled ? (
          <Stack gap="lg" style={{padding: '16px'}}>
            <Text>
              {t(
                'Builds matching this filter will process for %s. By default, all builds will process.',
                title
              )}
            </Text>

            <PreprodSearchBar
              initialQuery={localQuery}
              projects={[Number(project.id)]}
              allowedKeys={FEATURE_FILTER_ALLOWED_KEYS}
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
              error={buildsQuery.error}
              organizationSlug={organization.slug}
              hasSearchQuery={!!localQuery}
              display={display}
            />
          </Stack>
        ) : (
          <Container padding="md">
            <Text align="center" variant="muted" italic>
              {t('Enable %s above to configure filters.', title.toLowerCase())}
            </Text>
          </Container>
        )}
      </PanelBody>
    </Panel>
  );
}
