import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import * as Sentry from '@sentry/react';

import {useOrganizationRepositoriesWithSettings} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import type {
  IntegrationProvider,
  OrganizationIntegration,
  RepositoryWithSettings,
} from 'sentry/types/integrations';

import {useIntegrationInstallation} from './useIntegrationInstallation';
import {useIntegrationProvider} from './useIntegrationProvider';

interface SeerOnboardingContextProps {
  addRepositoryProjectMappings: (additionalMappings: Record<string, string[]>) => void;
  addRootCauseAnalysisRepository: (repoId: string) => void;
  autoCreatePR: RefObject<boolean | null> | null;
  changeRepositoryProjectMapping: (
    repoId: string,
    index: number,
    newValue: string | undefined
  ) => void;
  changeRootCauseAnalysisRepository: (oldRepoId: string, newRepoId: string) => void;
  clearRootCauseAnalysisRepositories: () => void;
  installationData: OrganizationIntegration[] | undefined;
  isInstallationPending: boolean;
  isProviderPending: boolean;
  isRepositoriesFetching: boolean;
  provider: IntegrationProvider | undefined;
  removeRootCauseAnalysisRepository: (repoId: string) => void;
  repositories: RepositoryWithSettings[] | undefined;
  repositoryProjectMapping: Record<string, string[]>;
  selectedCodeReviewRepositories: RepositoryWithSettings[];
  selectedCodeReviewRepositoriesMap: Record<string, boolean>;
  selectedRootCauseAnalysisRepositories: RepositoryWithSettings[];
  setAutoCreatePR: (value: boolean) => void;
  setCodeReviewRepositories: (newSelections: Record<string, boolean>) => void;
  unselectedCodeReviewRepositories: RepositoryWithSettings[];
}

const SeerOnboardingContext = createContext<SeerOnboardingContextProps>({
  autoCreatePR: null,
  installationData: undefined,
  isInstallationPending: false,
  isProviderPending: false,
  isRepositoriesFetching: false,
  provider: undefined,
  repositories: undefined,
  selectedCodeReviewRepositories: [],
  selectedCodeReviewRepositoriesMap: {},
  selectedRootCauseAnalysisRepositories: [],
  unselectedCodeReviewRepositories: [],
  repositoryProjectMapping: {},
  changeRepositoryProjectMapping: () => {},
  changeRootCauseAnalysisRepository: () => {},
  clearRootCauseAnalysisRepositories: () => {},
  setAutoCreatePR: () => {},
  setCodeReviewRepositories: () => {},
  removeRootCauseAnalysisRepository: () => {},
  addRootCauseAnalysisRepository: () => {},
  addRepositoryProjectMappings: () => {},
});

export function SeerOnboardingProvider({children}: {children: React.ReactNode}) {
  const [selectedCodeReviewRepositoriesMap, setSelectedCodeReviewRepositoriesMap] =
    useState<Record<string, boolean>>({});
  const [selectedRootCauseAnalysisRepositories, setRootCauseAnalysisRepositories] =
    useState<RepositoryWithSettings[]>([]);
  const [repositoryProjectMapping, setRepositoryProjectMapping] = useState<
    Record<string, string[]>
  >({});
  // This is not state because we just avoid re-render. This is used on a different view than
  // where it is set, so we don't need the reactivity.
  const autoCreatePRRef = useRef<boolean | null>(null);

  // Track if we've initialized the map to avoid overwriting user changes
  const hasInitializedCodeReviewMap = useRef(false);

  const {data: repositories, isFetching: isRepositoriesFetching} =
    useOrganizationRepositoriesWithSettings();
  const {data: installationData, isPending: isInstallationPending} =
    useIntegrationInstallation('github');
  const {provider, isPending: isProviderPending} = useIntegrationProvider('github');

  // Initialize selectedCodeReviewRepositoriesMap from server data
  useEffect(() => {
    if (!repositories || isRepositoriesFetching || hasInitializedCodeReviewMap.current) {
      return;
    }

    const initialMap = repositories.reduce<Record<string, boolean>>((acc, repo) => {
      if (repo.settings?.enabledCodeReview) {
        acc[repo.id] = true;
      }
      return acc;
    }, {});

    setSelectedCodeReviewRepositoriesMap(initialMap);

    // Initialize RCA repos to match code review repos (keeping them in sync)
    const enabledRepos = repositories.filter(repo => repo.settings?.enabledCodeReview);
    setRootCauseAnalysisRepositories(enabledRepos);

    hasInitializedCodeReviewMap.current = true;
  }, [repositories, isRepositoriesFetching]);

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

  /**
   * Repositories that were selected but became unselected
   */
  const unselectedCodeReviewRepositories = useMemo(
    () =>
      Object.entries(selectedCodeReviewRepositoriesMap)
        .filter(([_, isSelected]) => !isSelected)
        .map(([repoId]) => repositoriesMap[repoId])
        .filter(repo => repo !== undefined),
    [selectedCodeReviewRepositoriesMap, repositoriesMap]
  );

  const setAutoCreatePR = useCallback((value: boolean) => {
    autoCreatePRRef.current = value;
  }, []);

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
          .map(([repoId]) => repositoriesMap[repoId] as RepositoryWithSettings);

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

  const changeRootCauseAnalysisRepository = useCallback(
    (oldRepoId: string, newRepoId: string) => {
      const newRepo = repositoriesMap[newRepoId];
      if (!newRepo) {
        return;
      }

      let shouldUpdateMappings = false;

      // The updater function below executes synchronously, so shouldUpdateMappings
      // will be set before we check it. Only the re-render is async.
      setRootCauseAnalysisRepositories(prev => {
        // Check if the new repository is already selected using current state
        const isDuplicate = prev.some(
          repo => repo.id === newRepoId && repo.id !== oldRepoId
        );
        if (isDuplicate) {
          return prev;
        }

        // Mark that we should update mappings (executes synchronously)
        shouldUpdateMappings = true;

        // Replace the old repository with the new one
        return prev.map(repo => (repo.id === oldRepoId ? newRepo : repo));
      });

      // Only clear project mappings if the repository was actually changed
      if (shouldUpdateMappings) {
        setRepositoryProjectMapping(prev => {
          const newMappings = {...prev};
          delete newMappings[oldRepoId];
          return newMappings;
        });
      }
    },
    [repositoriesMap]
  );

  const clearRootCauseAnalysisRepositories = useCallback(() => {
    setRootCauseAnalysisRepositories([]);
    setRepositoryProjectMapping({});
  }, [setRootCauseAnalysisRepositories, setRepositoryProjectMapping]);

  const addRootCauseAnalysisRepository = useCallback(
    (repoId: string) => {
      const repo = repositoriesMap[repoId];
      if (!repo) {
        Sentry.logger.warn(
          'SeerOnboarding: Repository not found when adding new repository',
          {repoId}
        );
        return;
      }

      // Add repository to the list
      setRootCauseAnalysisRepositories(prev => [...prev, repo]);

      // Initialize empty project mapping
      setRepositoryProjectMapping(prev => ({
        ...prev,
        [repoId]: [],
      }));
    },
    [repositoriesMap]
  );

  const addRepositoryProjectMappings = useCallback(
    (additionalMappings: Record<string, string[]>) => {
      setRepositoryProjectMapping(prev => {
        return {
          ...prev,
          ...Object.fromEntries(
            Object.entries(additionalMappings)
              .map(([repoId, projects]) => {
                // Don't overwrite existing mappings that have projects
                if (prev[repoId] && prev[repoId].length > 0) {
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
        unselectedCodeReviewRepositories,
        selectedCodeReviewRepositoriesMap,
        setCodeReviewRepositories,
        selectedRootCauseAnalysisRepositories,
        removeRootCauseAnalysisRepository,
        changeRootCauseAnalysisRepository,
        addRootCauseAnalysisRepository,
        repositoryProjectMapping,
        addRepositoryProjectMappings,
        changeRepositoryProjectMapping,
        clearRootCauseAnalysisRepositories,
        setAutoCreatePR,
        autoCreatePR: autoCreatePRRef,
      }}
    >
      {children}
    </SeerOnboardingContext.Provider>
  );
}

export function useSeerOnboardingContext() {
  return useContext(SeerOnboardingContext);
}
