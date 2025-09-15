import {createContext, useContext} from 'react';

import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {useApiQuery} from 'sentry/utils/queryClient';

interface FrontendVersionResponse {
  /**
   * The commit SHA of the latest version available on the server.
   */
  version: string | null;
}

type State = 'unknown' | 'disabled' | 'stale' | 'current';

interface VersionStatus {
  /**
   * The commit SHA of the latest version available on the server.
   */
  deployedVersion: string | null;
  /**
   * The running frontend version. This is typically the SENTRY_RELEASE_VERSION
   * constant. Should be in the format `package@<commit-sha>`.
   */
  runningVersion: string | null;
  /**
   * Indicates the state of the running frontend version
   *
   * `current`  - The frontend app matches the version of the frontend the
   *              backend is currently serving.
   *
   * `stale`    - The backend is reporting a different version SHA from the
   *              version of the frontend app that is currently running.
   *
   * `disabled` - We explicitly are not checking if the frontend application is
   *              up-to-date. We only typically know the
   *
   * `unknown`  - We don't know if the frontend is up-to-date. Typically this
   *              is because we're waiting on the frontend-version request to
   *              the backend to complete.
   */
  state: State;
}

interface Props {
  children: React.ReactNode;
  /**
   * The running frontend version. This is typically the SENTRY_RELEASE_VERSION
   * constant. Should be in the format `package@<commit-sha>`.
   */
  releaseVersion: string | null;
  /**
   * Force the status for testing purposes. When enabled, disables the API
   * query and sets the forced state.
   */
  force?: State;
}

const FrontendVersionContext = createContext<VersionStatus>({
  state: 'unknown',
  deployedVersion: null,
  runningVersion: null,
});

/**
 * Context provider that polls the frontend version endpoint every 5 minutes
 * and on tab focus to detect if the frontend version has changed.
 */
export function FrontendVersionProvider({children, force, releaseVersion}: Props) {
  const {sentryMode} = useLegacyStore(ConfigStore);

  const enabled =
    !force &&
    //
    // We only make stale version assessments when talking to SAAS Sentry.
    sentryMode === 'SAAS' &&
    //
    // We only make stale version assessments when the frontend is running a
    // production build.
    process.env.NODE_ENV === 'production' &&
    //
    // We do not make stale version assessments when running deployment
    // previews, these are inherinetly a differning version from what is
    // deployed in production SAAS.
    DEPLOY_PREVIEW_CONFIG === undefined;

  const {data: frontendVersionData} = useApiQuery<FrontendVersionResponse>(
    ['/internal/frontend-version/'],
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      enabled,
    }
  );

  const runningVersion = releaseVersion?.split('@').at(1) ?? null;
  const deployedVersion = frontendVersionData?.version ?? null;

  function getState(): State {
    if (force) {
      return force;
    }
    if (!enabled) {
      return 'disabled';
    }
    if (deployedVersion === null) {
      return 'unknown';
    }

    if (deployedVersion !== runningVersion) {
      return 'stale';
    }

    return 'current';
  }
  const state = getState();

  return (
    <FrontendVersionContext.Provider value={{state, deployedVersion, runningVersion}}>
      {children}
    </FrontendVersionContext.Provider>
  );
}

/**
 * Hook to access frontend version information.
 */
export function useFrontendVersion(): VersionStatus {
  return useContext(FrontendVersionContext);
}
