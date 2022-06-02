import {useMemo} from 'react';

import {FlamegraphHeader} from 'sentry/components/profiling/flamegraphHeader';
import {DeepPartial} from 'sentry/types/utils';
import {
  decodeFlamegraphStateFromQueryParams,
  FlamegraphState,
  FlamegraphStateProvider,
  FlamegraphStateQueryParamSync,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/index';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useLocation} from 'sentry/utils/useLocation';

import ProfileGroupProvider from './profileGroupProvider';

interface FlamegraphProviderProps {
  children: React.ReactNode;
}

function FlamegraphProvider(props: FlamegraphProviderProps) {
  const location = useLocation();
  const initialFlamegraphPreferencesState = useMemo((): DeepPartial<FlamegraphState> => {
    return decodeFlamegraphStateFromQueryParams(location.query);
    // We only want to decode this when our component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProfileGroupProvider>
      <FlamegraphStateProvider initialState={initialFlamegraphPreferencesState}>
        <FlamegraphThemeProvider>
          <FlamegraphStateQueryParamSync />
          <FlamegraphHeader />
          {props.children}
        </FlamegraphThemeProvider>
      </FlamegraphStateProvider>
    </ProfileGroupProvider>
  );
}

export default FlamegraphProvider;
