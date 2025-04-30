import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Flex} from 'sentry/components/container/flex';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {RepoSettings} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

import {AddAutofixRepoModalContent} from './addAutofixRepoModal';
import {AutofixRepoItem} from './autofixRepoItem';
import {MAX_REPOS_LIMIT} from './constants';

interface ProjectSeerProps {
  project: Project;
}

function ProjectSeer({project}: ProjectSeerProps) {
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
      }
    }
  }, [preference, repositories, codeMappingRepos, updateProjectSeerPreferences]);

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
      });

      setShowSaveNotice(true);
    },
    [repositories, selectedRepoIds, repoSettings, updateProjectSeerPreferences]
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
          {t('Autofix Repositories')}
          <QuestionTooltip
            title={t(
              'Below are the repositories that Autofix will work on. Autofix will only be able to see code from and make PRs to the repositories that you select here.'
            )}
            size="sm"
          />
        </Flex>
        <div>
          <Button
            size="xs"
            icon={<IconAdd />}
            title={
              isRepoLimitReached
                ? t('Max repositories reached')
                : unselectedRepositories?.length === 0
                  ? t('No repositories to add')
                  : ''
            }
            disabled={isRepoLimitReached || unselectedRepositories?.length === 0}
            onClick={openAddRepoModal}
          >
            {t('Add Repos')}
          </Button>
        </div>
      </PanelHeader>

      {showSaveNotice && (
        <Alert type="info" showIcon system>
          {t(
            'Changes will apply on the next Autofix run or hit "Start Over" in the Autofix panel to start a new run and use your changes.'
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
          {t('No repositories selected. Click "Add Repos" to get started.')}
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

export default function ProjectSeerContainer({project}: ProjectSeerProps) {
  const organization = useOrganization();

  if (!organization.features.includes('autofix-seer-preferences')) {
    return (
      <FeatureDisabled
        features={['autofix-seer-preferences']}
        hideHelpToggle
        message={t('Autofix is not enabled for this organization.')}
        featureName={t('Autofix')}
      />
    );
  }

  return <ProjectSeer project={project} />;
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
  color: ${p => p.theme.subText};
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
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
  font-size: ${p => p.theme.fontSizeMedium};
`;
