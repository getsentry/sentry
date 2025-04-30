import {useLayoutEffect, useState} from 'react';

import {
  CodecovContext,
  DEFAULT_CODECOV_CONTEXT_VALUES,
  initializeCodecovContext,
  setRepositoryToContext,
} from 'sentry/components/codecov/context/context';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

// Types
export type CodecovContextTypes = {
  repository: string | null;
};

export type CodecovContextSetterTypes = {
  setRepository: (repository: string) => void;
  setState: React.Dispatch<React.SetStateAction<CodecovContextTypes>>;
};

type CodecovProviderProps = {
  children?: React.ReactNode;
};

/**
 * This is a provider that's meant to wrap all Codecov product components.
 * It initializes the Codecov context from url params and local storage.
 * It also defines setter methods for child components to update context data.
 */
export default function CodecovProvider({children}: CodecovProviderProps) {
  const [state, setState] = useState<CodecovContextTypes>(DEFAULT_CODECOV_CONTEXT_VALUES);
  const location = useLocation();
  const queryParams = location.query;

  const organization = useOrganization();
  const orgSlug = organization.slug;

  // Main container initialization
  useLayoutEffect(() => {
    initializeCodecovContext({queryParams, orgSlug, setState});
  }, [queryParams, orgSlug, setState]);

  // Context Setter Functions
  const setRepository: CodecovContextSetterTypes['setRepository'] = repository =>
    setRepositoryToContext({orgSlug, repository, setState});

  return (
    <CodecovContext.Provider value={{...state, setState, setRepository}}>
      {children}
    </CodecovContext.Provider>
  );
}
