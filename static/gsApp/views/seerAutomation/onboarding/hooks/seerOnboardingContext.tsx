import {createContext, useCallback, useContext, useMemo, useState} from 'react';

import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import type {
  IntegrationProvider,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';

import {useIntegrationInstallation} from './useIntegrationInstallation';
import {useIntegrationProvider} from './useIntegrationProvider';

interface SeerOnboardingContextProps {
  addRepositoryProjectMappings: (additionalMappings: Record<string, string[]>) => void;
  changeRepositoryProjectMapping: (
    repoId: string,
    index: number,
    newValue: string | undefined
  ) => void;
  installationData: OrganizationIntegration[] | undefined;
  isInstallationPending: boolean;
  isProviderPending: boolean;
  isRepositoriesFetching: boolean;
  provider: IntegrationProvider | undefined;
  removeRootCauseAnalysisRepository: (repoId: string) => void;
  repositories: Repository[] | undefined;
  repositoryProjectMapping: Record<string, string[]>;
  selectedCodeReviewRepositories: Repository[];
  selectedCodeReviewRepositoriesMap: Record<string, boolean>;
  selectedRootCauseAnalysisRepositories: Repository[];
  setCodeReviewRepositories: (newSelections: Record<string, boolean>) => void;
}

const SeerOnboardingContext = createContext<SeerOnboardingContextProps>({
  installationData: undefined,
  isInstallationPending: false,
  isProviderPending: false,
  isRepositoriesFetching: false,
  provider: undefined,
  repositories: undefined,
  selectedCodeReviewRepositories: [],
  selectedCodeReviewRepositoriesMap: {},
  selectedRootCauseAnalysisRepositories: [],
  repositoryProjectMapping: {},
  changeRepositoryProjectMapping: () => {},
  setCodeReviewRepositories: () => {},
  removeRootCauseAnalysisRepository: () => {},
  addRepositoryProjectMappings: () => {},
});

export function SeerOnboardingProvider({children}: {children: React.ReactNode}) {
  const [selectedCodeReviewRepositoriesMap, setSelectedCodeReviewRepositoriesMap] =
    useState<Record<string, boolean>>({});
  const [selectedRootCauseAnalysisRepositories, setRootCauseAnalysisRepositories] =
    useState<Repository[]>([]);
  const [repositoryProjectMapping, setRepositoryProjectMapping] = useState<
    Record<string, string[]>
  >({});

  const {data: repositories, isFetching: isRepositoriesFetching} =
    useOrganizationRepositories();
  const {data: installationData, isPending: isInstallationPending} =
    useIntegrationInstallation('github');
  const {provider, isPending: isProviderPending} = useIntegrationProvider('github');

  // Create map for lookup for `selectedRepositories`
  const repositoriesMap = useMemo(
    () => Object.fromEntries(repositories?.map(repo => [repo.id, repo]) ?? []),
    [repositories]
  );

  const selectedCodeReviewRepositories = useMemo(
    () =>
      Object.entries(selectedCodeReviewRepositoriesMap)
        .filter(([_, isSelected]) => isSelected)
        .map(([repoId]) => repositoriesMap[repoId])
        .filter(repo => repo !== undefined),
    [selectedCodeReviewRepositoriesMap, repositoriesMap]
  );

  const setCodeReviewRepositories = useCallback(
    (newSelections: Record<string, boolean>) => {
      setSelectedCodeReviewRepositoriesMap(prev => ({...prev, ...newSelections}));

      // We are keeping RCA repos in sync with code review repos because
      // RCA repos = code review repos + any repos added in the RCA step
      setRootCauseAnalysisRepositories(prev => {
        // Filter out repositories that were selected or updated (e.g. present in `newSelections`),
        // so that we don't have duplicates when we merge the two
        const existingRepos = prev.filter(repo => newSelections[repo.id] === undefined);

        // Add new repositories that were selected
        const newRepos = Object.entries(newSelections)
          .filter(([repoId, isSelected]) => isSelected && repoId in repositoriesMap)
          .map(([repoId]) => repositoriesMap[repoId] as Repository);

        return [...existingRepos, ...newRepos];
      });
    },
    [repositoriesMap]
  );

  const removeRootCauseAnalysisRepository = useCallback(
    (repoId: string) => {
      setRepositoryProjectMapping(prev => {
        const newMappings = {...prev};
        delete newMappings[repoId];
        return newMappings;
      });
      setRootCauseAnalysisRepositories(prev => prev.filter(repo => repo.id !== repoId));
    },
    [setRootCauseAnalysisRepositories]
  );

  const addRepositoryProjectMappings = useCallback(
    (additionalMappings: Record<string, string[]>) => {
      setRepositoryProjectMapping(prev => {
        return {
          ...prev,
          ...Object.fromEntries(
            Object.entries(additionalMappings)
              .map(([repoId, projects]) => {
                // Don't overwrite existing mappings
                if (prev[repoId]) {
                  return null;
                }
                return [repoId, projects];
              })
              .filter(i => i !== null)
          ),
        };
      });
    },
    [setRepositoryProjectMapping]
  );

  const changeRepositoryProjectMapping = useCallback(
    (repoId: string, index: number, newValue: string | undefined) => {
      setRepositoryProjectMapping(prev => {
        const currentProjects = prev[repoId] || [];

        if (newValue && currentProjects.includes(newValue)) {
          // Project is already mapped to this repo, show an error message and don't update anything
          // We could make our dropdowns smarter by filtering out selected projects,
          // but this is much simpler.
          return prev;
        }

        const newProjects = [...currentProjects];

        if (newValue === undefined) {
          // Remove the project at this index
          newProjects.splice(index, 1);
        } else if (index >= newProjects.length) {
          // Adding a new project
          newProjects.push(newValue);
        } else {
          // Replacing an existing project
          newProjects[index] = newValue;
        }

        const result = {
          ...prev,
          [repoId]: newProjects,
        };

        return result;
      });
    },
    [setRepositoryProjectMapping]
  );

  return (
    <SeerOnboardingContext.Provider
      value={{
        repositories,
        isRepositoriesFetching,
        installationData,
        isInstallationPending,
        provider,
        isProviderPending,
        selectedCodeReviewRepositories,
        selectedCodeReviewRepositoriesMap,
        setCodeReviewRepositories,
        selectedRootCauseAnalysisRepositories,
        removeRootCauseAnalysisRepository,
        repositoryProjectMapping,
        addRepositoryProjectMappings,
        changeRepositoryProjectMapping,
      }}
    >
      {children}
    </SeerOnboardingContext.Provider>
  );
}

export function useSeerOnboardingContext() {
  return useContext(SeerOnboardingContext);
}
