import {createContext, useContext, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

const LOADING_OR_FALLBACK_FLAMEGRAPH = Flamegraph.Empty();

const FlamegraphContext = createContext<Flamegraph | null>(null);

export const useFlamegraph = () => {
  const context = useContext(FlamegraphContext);
  if (!context) {
    throw new Error('useFlamegraph was called outside of FlamegraphProvider');
  }
  return context;
};

interface FlamegraphProviderProps {
  children: React.ReactNode;
}

export function FlamegraphProvider(props: FlamegraphProviderProps) {
  const profileGroup = useProfileGroup();
  const {threadId} = useFlamegraphProfiles();
  const {sorting, view} = useFlamegraphPreferences();

  const flamegraph = useMemo(() => {
    if (typeof threadId !== 'number') {
      return LOADING_OR_FALLBACK_FLAMEGRAPH;
    }

    // This could happen if threadId was initialized from query string, but for some
    // reason the profile was removed from the list of profiles.
    const activeProfile = profileGroup.profiles.find(p => p.threadId === threadId);
    if (!activeProfile) {
      return LOADING_OR_FALLBACK_FLAMEGRAPH;
    }

    const transaction = Sentry.startTransaction({
      op: 'import',
      name: 'flamegraph.constructor',
    });

    transaction.setTag('sorting', sorting.split(' ').join('_'));
    transaction.setTag('view', view.split(' ').join('_'));

    const newFlamegraph = new Flamegraph(activeProfile, {
      inverted: view === 'bottom up',
      sort: sorting,
      configSpace: undefined,
    });

    transaction.finish();

    return newFlamegraph;
  }, [sorting, threadId, view, profileGroup]);

  return (
    <FlamegraphContext.Provider value={flamegraph}>
      {props.children}
    </FlamegraphContext.Provider>
  );
}
