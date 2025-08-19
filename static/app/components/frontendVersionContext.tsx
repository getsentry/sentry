import {createContext, useContext, type ReactNode} from 'react';

import {useApiQuery} from 'sentry/utils/queryClient';

interface FrontendVersionResponse {
  /**
   * The commit SHA of the latest version available on the server.
   */
  version: string | null;
}

interface VersionStatus {
  /**
   * The commit SHA of the latest version available on the server.
   */
  deployedVersion: string | null;
  /**
   * True if the server version differs from the currently running frontend
   * version.
   */
  stale: boolean;
}

interface Props {
  children: ReactNode;
  /**
   * The running frontend version. This is typically the SENTRY_RELEASE_VERSION
   * constant. Should be in the format `package@<commit-sha>`.
   */
  releaseVersion: string | null;
  /**
   * Force the stale status to true. Typically used for testing purposes
   * When enabled, disables the API query and sets stale=true,
   * deployedVersion=null.
   */
  forceStale?: boolean;
}

const FrontendVersionContext = createContext<VersionStatus>({
  stale: false,
  deployedVersion: null,
});

/**
 * Context provider that polls the frontend version endpoint every 5 minutes
 * and on tab focus to detect if the frontend version has changed.
 */
export function FrontendVersionProvider({children, forceStale, releaseVersion}: Props) {
  const {data: frontendVersionData} = useApiQuery<FrontendVersionResponse>(
    ['/internal/frontend-version/'],
    {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      enabled: !forceStale,
    }
  );

  const runningVersion = releaseVersion?.split('@').at(1) ?? null;
  const deployedVersion = frontendVersionData?.version ?? null;

  const stale = forceStale || (!!deployedVersion && deployedVersion !== runningVersion);

  return (
    <FrontendVersionContext.Provider value={{stale, deployedVersion}}>
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
