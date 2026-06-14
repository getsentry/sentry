import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useInfiniteQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {RepoSettings} from 'sentry/components/events/autofix/types';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  organizationRepositoriesInfiniteOptions,
  selectUniqueRepos,
} from 'sentry/utils/repositories/repoQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUpdateSeerRepos} from 'sentry/utils/seer/useUpdateSeerRepos';

import {AddAutofixRepoModal} from './addAutofixRepoModal';
import {AutofixRepoItem} from './autofixRepoItem';
import {MAX_REPOS_LIMIT} from './constants';

interface ProjectSeerProps {
  project: Project;
}

export function AutofixRepositories({project}: ProjectSeerProps) {
  const {openModal} = useModal();

  const theme = useTheme();
  const organization = useOrganization();
  const repositoriesQuery = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({organization, query: {per_page: 100}}),
    select: selectUniqueRepos,
  });
  useFetchAllPages({result: repositoriesQuery});
  const {data: repositories, isFetching: isFetchingRepositories} = repositoriesQuery;
  const {data, isPending: isLoadingPreferences} = useProjectSeerPreferences(project);
  const {preference, code_mapping_repos: codeMappingRepos} = data ?? {};
  const {mutate: updateSeerRepos} = useUpdateSeerRepos(project);

  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [repoSettings, setRepoSettings] = useState<Record<string, RepoSettings>>({});
  const [showSaveNotice, setShowSaveNotice] = useState(false);


  useEffect(() => {
    if (repositories) {
      if (preference?.repositories) {
        // Handle existing preferences
        const preferencesMap = new Map(
          preference.repositories.map(repo => [
            repo.external_id,
            {
              branch: repo.branch_name || '',
              instructions: repo.instructions || '',
              branch_overrides: repo.branch_overrides || [],
            },
          ])
        );

        setSelectedRepoIds(preference.repositories.map(repo => repo.external_id));

        const initialSettings: Record<string, RepoSettings> = {};
        repositories.forEach(repo => {
          initialSettings[repo.externalId] = preferencesMap.get(repo.externalId) || {
            branch: '',
            instructions: '',
            branch_overrides: [],
          };
        });

        setRepoSettings(initialSettings);
      } else if (codeMappingRepos?.length) {
        // Set default settings using codeMappingRepos when no preferences exist
        const repoIds = codeMappingRepos.map(repo => repo.external_id);
        setSelectedRepoIds(repoIds);

        const initialSettings: Record<string, RepoSettings> = {};
        repositories.forEach(repo => {
          initialSettings[repo.externalId] = {
            branch: '',
            instructions: '',
            branch_overrides: [],
          };
        });

        setRepoSettings(initialSettings);
      }
    }
  }, [preference, repositories, codeMappingRepos]);

  const updatePreferences = useCallback(
    (updatedIds?: string[], updatedSettings?: Record<string, RepoSettings>) => {
      if (!repositories) {
        return;
      }
      const idsToUse = updatedIds || selectedRepoIds;
      const settingsToUse = updatedSettings || repoSettings;
      const selectedRepos = repositories.filter(repo =>
        idsToUse.includes(repo.externalId)
      );
      const reposPayload = selectedRepos.map(repo => ({
        repositoryId: Number(repo.id),
        branchName: settingsToUse[repo.externalId]?.branch || null,
        instructions: settingsToUse[repo.externalId]?.instructions || null,
        branchOverrides: settingsToUse[repo.externalId]?.branch_overrides || [],
      }));
      updateSeerRepos(reposPayload);
      setShowSaveNotice(true);
    },
    [repositories, selectedRepoIds, repoSettings, updateSeerRepos]
  );

  const handleSaveModalSelections = useCallback(
    (modalSelectedIds: string[]) => {
      setSelectedRepoIds(modalSelectedIds);
      updatePreferences(modalSelectedIds);
    },
    [updatePreferences]
  );

  const removeRepository = (repoId: string) => {
    setSelectedRepoIds(prevSelectedIds => {
      const newIds = prevSelectedIds.filter(id => id !== repoId);
      updatePreferences(newIds);
      return newIds;
    });
  };

  const updateRepoSettings = (repoId: string, settings: RepoSettings) => {
    setRepoSettings(prev => {
      const newSettings = {
        ...prev,
        [repoId]: settings,
      };

      updatePreferences(undefined, newSettings);

      return newSettings;
    });
  };

  const {unselectedRepositories, filteredSelectedRepositories} = useMemo(() => {
    if (!repositories || repositories.length === 0) {
      return {
        unselectedRepositories: [],
        filteredSelectedRepositories: [],
      };
    }

    const selected = repositories.filter(repo =>
      selectedRepoIds.includes(repo.externalId)
    );
    const unselected = repositories.filter(
      repo => !selectedRepoIds.includes(repo.externalId)
    );

    const filteredSelected = selected.filter(
      repo => repo.provider?.id && repo.provider.id !== 'unknown' && repo.integrationId
    );

    return {
      unselectedRepositories: unselected,
      filteredSelectedRepositories: filteredSelected,
    };
  }, [repositories, selectedRepoIds]);

  const isRepoLimitReached = selectedRepoIds.length >= MAX_REPOS_LIMIT;

  const openAddRepoModal = () => {
    openModal(deps => (
      <AddAutofixRepoModal
        {...deps}
        selectedRepoIds={selectedRepoIds}
        onSave={handleSaveModalSelections}
      />
    ));
  };

  return (
    <Panel>
      <PanelHeader hasButtons>
        <Flex align="center" gap="xs">
          {t('Working Repositories')}
          <QuestionTooltip
            title={tct(
              'Seer will only be able to see code from and make PRs to the repos that you select here. The [link:GitHub integration] is required for Seer to access these repos.',
              {
                link: <Link to={`/settings/${organization.slug}/integrations/github/`} />,
              }
            )}
            size="sm"
            isHoverable
          />
        </Flex>
        <div style={{display: 'flex', alignItems: 'center', gap: theme.space.md}}>
          <DropdownMenu
            size="sm"
            triggerLabel={t('Manage Integration')}
            items={[
              {
                key: 'github',
                textValue: t('GitHub'),
                label: (
                  <Flex gap="sm" align="center">
                    <PluginIcon pluginId="github" size={16} />
                    <div>{t('GitHub')}</div>
                  </Flex>
                ),
                to: `/settings/${organization.slug}/integrations/github/`,
              },
              {
                key: 'github_enterprise',
                textValue: t('GitHub Enterprise'),
                label: (
                  <Flex gap="sm" align="center">
                    <PluginIcon pluginId="github_enterprise" size={16} />
                    <div>{t('GitHub Enterprise')}</div>
                  </Flex>
                ),
                to: `/settings/${organization.slug}/integrations/github_enterprise/`,
              },
            ]}
          />
          <Tooltip
            isHoverable
            title={
              isRepoLimitReached
                ? 'Max repositories reached'
                : unselectedRepositories?.length === 0
                  ? tct(
                      'No repositories to add. [manageRepositoriesLink:Manage repositories in Organization Settings.]',
                      {
                        manageRepositoriesLink: (
                          <Link to={`/settings/${organization.slug}/repos/`} />
                        ),
                      }
                    )
                  : null
            }
          >
            <Button
              size="sm"
              icon={<IconAdd />}
              disabled={isRepoLimitReached || unselectedRepositories?.length === 0}
              onClick={openAddRepoModal}
              variant={
                !isFetchingRepositories &&
                !isLoadingPreferences &&
                filteredSelectedRepositories.length === 0
                  ? 'primary'
                  : 'secondary'
              }
            >
              {t('Add Repos')}
            </Button>
          </Tooltip>
        </div>
      </PanelHeader>

      {showSaveNotice && (
        <Alert variant="info" system>
          {t(
            'Changes will apply on future Seer runs. Hit "Start Over" in the Seer panel to start a new run and use your new selected repositories.'
          )}
        </Alert>
      )}
      {isFetchingRepositories || isLoadingPreferences ? (
        <Stack justify="center" align="center" padding="3xl" gap="xl" width="100%">
          <StyledLoadingIndicator size={36} />
          <LoadingMessage>{t('Loading repositories...')}</LoadingMessage>
        </Stack>
      ) : filteredSelectedRepositories.length === 0 ? (
        <EmptyMessage>
          {t("Seer can't see your code. Click 'Add Repos' to give Seer access.")}
        </EmptyMessage>
      ) : (
        <ReposContainer>
          {filteredSelectedRepositories.map(repo => (
            <AutofixRepoItem
              key={repo.id}
              repo={repo}
              settings={
                repoSettings[repo.externalId] || {
                  branch: '',
                  instructions: '',
                  branch_overrides: [],
                }
              }
              onSettingsChange={settings => {
                updateRepoSettings(repo.externalId, settings);
              }}
              onRemove={() => {
                removeRepository(repo.externalId);
              }}
            />
          ))}
        </ReposContainer>
      )}
    </Panel>
  );
}

const ReposContainer = styled('div')`
  display: flex;
  flex-direction: column;

  & > div:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const EmptyMessage = styled('div')`
  padding: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.danger};
  text-align: center;
  font-size: ${p => p.theme.font.size.md};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

const LoadingMessage = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;
