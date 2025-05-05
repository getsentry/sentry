import {useState} from 'react';

import {CodecovContext} from 'sentry/components/codecov/context/context';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

// Types
export type CodecovContextTypes = {
  branch: string | null;
  codecovPeriod: string | null;
  integratedOrg: string | null;
  repository: string | null;
};
export type CodecovContextSetterTypes = {
  setContextState: React.Dispatch<React.SetStateAction<CodecovContextTypes>>;
  updateSelectorData: (value: Partial<CodecovContextTypes>) => void;
};
type CodecovUrlParams = 'repository' | 'integratedOrg' | 'branch' | '';

type CodecovProviderProps = {
  children?: React.ReactNode;
};

// Constants
const DEFAULT_CODECOV_CONTEXT_VALUES: CodecovContextTypes = {
  repository: null,
  integratedOrg: null,
  branch: null,
  codecovPeriod: null,
};
const CODECOV_URL_PARAM: CodecovUrlParams[] = ['repository'];

/**
 * This is a provider that's meant to wrap all Codecov product components.
 * It initializes the Codecov context from url params and local storage.
 * It also defines setter methods for child components to update context data.
 */
export default function CodecovProvider({children}: CodecovProviderProps) {
  const location = useLocation();
  const queryParams = location.query;

  const organization = useOrganization();
  const orgSlug = organization.slug;

  const [selectorData, setSelectorData] = useLocalStorageState(
    `codecov-selection:${orgSlug}`,
    DEFAULT_CODECOV_CONTEXT_VALUES
  );
  const navigate = useNavigate();

  // Initializes context state from query parameters or local storage, otherwise
  // with a default value.
  const [contextState, setContextState] = useState(() => {
    // Get query params
    const resultsFromQuery = CODECOV_URL_PARAM.reduce<Record<string, string | null>>(
      (acc, value: string) => {
        const queryParam = queryParams[value];
        acc[value] =
          typeof queryParam === 'string' ? decodeURIComponent(queryParam).trim() : null;
        return acc;
      },
      {}
    );
    const hasAnyNonNull = Object.values(resultsFromQuery).some(value => value !== null);
    if (hasAnyNonNull) {
      return {...DEFAULT_CODECOV_CONTEXT_VALUES, ...resultsFromQuery};
    }

    // Get data from local storage
    if (selectorData) {
      return {...DEFAULT_CODECOV_CONTEXT_VALUES, ...selectorData};
    }

    return DEFAULT_CODECOV_CONTEXT_VALUES;
  });

  // Updates Codecov context, local storage and query params
  const updateSelectorData: CodecovContextSetterTypes['updateSelectorData'] = data => {
    return setContextState(prev => {
      const newState = {...prev, ...data};
      setSelectorData(newState);

      const currentParams = new URLSearchParams(location.search);
      for (const [key, value] of Object.entries(newState)) {
        if (value !== null) {
          currentParams.set(key, value);
        }
      }
      navigate(`${location.pathname}?${currentParams.toString()}`, {replace: true});

      return newState;
    });
  };

  return (
    <CodecovContext.Provider
      value={{...contextState, setContextState, updateSelectorData}}
    >
      {children}
    </CodecovContext.Provider>
  );
}
