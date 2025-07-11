import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {RepoSettings} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconAdd, IconGithub} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

import {AddAutofixRepoModalContent} from './addAutofixRepoModal';
import {AutofixRepoItem} from './autofixRepoItem';
import {MAX_REPOS_LIMIT} from './constants';

interface ProjectSeerProps {
  project: Project;
}

export function AutofixRepositories({project}: ProjectSeerProps) {
  const organization = useOrganization();
  const {data: repositories, isFetching: isFetchingRepositories} =
    useOrganizationRepositories();
  const {
    preference,
    codeMappingRepos,
    isPending: isLoadingPreferences,
  } = useProjectSeerPreferences(project);
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [repoSettings, setRepoSettings] = useState<Record<string, RepoSettings>>({});
  const [showSaveNotice, setShowSaveNotice] = useState(false);
  const [automatedRunStoppingPoint, setAutomatedRunStoppingPoint] = useState<
    'solution' | 'code_changes' | 'open_pr'
  >('solution');

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
            },
          ])
        );

        setSelectedRepoIds(preference.repositories.map(repo => repo.external_id));

        const initialSettings: Record<string, RepoSettings> = {};
        repositories.forEach(repo => {
          initialSettings[repo.externalId] = preferencesMap.get(repo.externalId) || {
            branch: '',
            instructions: '',
          };
        });

        setRepoSettings(initialSettings);
        setAutomatedRunStoppingPoint(
          preference.automated_run_stopping_point || 'solution'
        );
      } else if (codeMappingRepos?.length) {
        // Set default settings using codeMappingRepos when no preferences exist
        const repoIds = codeMappingRepos.map(repo => repo.external_id);
        setSelectedRepoIds(repoIds);

        const initialSettings: Record<string, RepoSettings> = {};
        repositories.forEach(repo => {
          initialSettings[repo.externalId] = {
            branch: '',
            instructions: '',
          };
        });

        setRepoSettings(initialSettings);
        setAutomatedRunStoppingPoint('solution');
      }
    }
  }, [preference, repositories, codeMappingRepos, updateProjectSeerPreferences]);

  const updatePreferences = useCallback(
    (
      updatedIds?: string[],
      updatedSettings?: Record<string, RepoSettings>,
      newStoppingPoint?: 'solution' | 'code_changes' | 'open_pr'
    ) => {
      if (!repositories) {
        return;
      }
      const idsToUse = updatedIds || selectedRepoIds;
      const settingsToUse = updatedSettings || repoSettings;
      const stoppingPointToUse = newStoppingPoint || automatedRunStoppingPoint;
      const selectedRepos = repositories.filter(repo =>
        idsToUse.includes(repo.externalId)
      );
      const reposData = selectedRepos.map(repo => {
        const [owner, name] = (repo.name || '/').split('/');
        return {
          provider: repo.provider?.name?.toLowerCase() || '',
          owner: owner || '',
          name: name || repo.name || '',
          external_id: repo.externalId,
          branch_name: settingsToUse[repo.externalId]?.branch || '',
          instructions: settingsToUse[repo.externalId]?.instructions || '',
        };
      });
      updateProjectSeerPreferences({
        repositories: reposData,
        automated_run_stopping_point: stoppingPointToUse,
      });
      setShowSaveNotice(true);
    },
    [
      repositories,
      selectedRepoIds,
      repoSettings,
      automatedRunStoppingPoint,
      updateProjectSeerPreferences,
    ]
  );

  const handleSaveModalSelections = useCallback(
    (modalSelectedIds: string[]) => {
      setSelectedRepoIds(modalSelectedIds);
      updatePreferences(modalSelectedIds);
    },
    [updatePreferences]
  );

  const removeRepository = useCallback(
    (repoId: string) => {
      setSelectedRepoIds(prevSelectedIds => {
        const newIds = prevSelectedIds.filter(id => id !== repoId);
        updatePreferences(newIds);
        return newIds;
      });
    },
    [updatePreferences]
  );

  const updateRepoSettings = useCallback(
    (repoId: string, settings: RepoSettings) => {
      setRepoSettings(prev => {
        const newSettings = {
          ...prev,
          [repoId]: settings,
        };

        updatePreferences(undefined, newSettings);

        return newSettings;
      });
    },
    [updatePreferences]
  );

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
      repo => repo.provider?.id && repo.provider.id !== 'unknown'
    );

    return {
      unselectedRepositories: unselected,
      filteredSelectedRepositories: filteredSelected,
    };
  }, [repositories, selectedRepoIds]);

  const isRepoLimitReached = selectedRepoIds.length >= MAX_REPOS_LIMIT;

  const openAddRepoModal = useCallback(() => {
    openModal(deps => (
      <AddAutofixRepoModalContent
        {...deps}
        repositories={repositories || []}
        selectedRepoIds={selectedRepoIds}
        onSave={handleSaveModalSelections}
        isFetchingRepositories={isFetchingRepositories}
        maxReposLimit={MAX_REPOS_LIMIT}
      />
    ));
  }, [repositories, selectedRepoIds, handleSaveModalSelections, isFetchingRepositories]);

  return (
    <Panel>
      <PanelHeader hasButtons>
        <Flex align="center" gap={space(0.5)}>
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
        <div style={{display: 'flex', alignItems: 'center', gap: space(1)}}>
          <LinkButton
            size="sm"
            icon={<IconGithub />}
            to={`/settings/${organization.slug}/integrations/github/`}
            style={{textTransform: 'none'}}
          >
            {t('Manage Integration')}
          </LinkButton>
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
            >
              {t('Add Repos')}
            </Button>
          </Tooltip>
        </div>
      </PanelHeader>

      {showSaveNotice && (
        <Alert type="info" showIcon system>
          {t(
            'Changes will apply on future Seer runs. Hit "Start Over" in the Seer panel to start a new run and use your new selected repositories.'
          )}
        </Alert>
      )}
      {isFetchingRepositories || isLoadingPreferences ? (
        <LoadingContainer>
          <StyledLoadingIndicator size={36} />
          <LoadingMessage>{t('Loading repositories...')}</LoadingMessage>
        </LoadingContainer>
      ) : filteredSelectedRepositories.length === 0 ? (
        <EmptyMessage>
          {t('Your code is not available to Seer. Click "Add Repos" to get started.')}
        </EmptyMessage>
      ) : (
        <ReposContainer>
          {filteredSelectedRepositories.map(repo => (
            <AutofixRepoItem
              key={repo.id}
              repo={repo}
              settings={repoSettings[repo.externalId] || {branch: '', instructions: ''}}
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
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const EmptyMessage = styled('div')`
  padding: ${space(2)};
  color: ${p => p.theme.errorText};
  text-align: center;
  font-size: ${p => p.theme.fontSize.md};
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(4)};
  width: 100%;
  flex-direction: column;
  gap: ${space(2)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

const LoadingMessage = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;
