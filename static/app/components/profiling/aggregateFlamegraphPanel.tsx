import {Panel} from 'sentry/components/panels';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

export function AggregateFlamegraphPanel({transaction}: {transaction: string}) {
  const query = useAggregateFlamegraphQuery({transaction});

  return (
    <ProfileGroupProvider type="flamegraph" input={query.data ?? null} traceID="">
      <FlamegraphStateProvider
        initialState={{
          preferences: {
            sorting: 'alphabetical',
            view: 'bottom up',
          },
        }}
      >
        <FlamegraphThemeProvider>
          <Panel>
            <AggregateFlamegraph />
          </Panel>
        </FlamegraphThemeProvider>
      </FlamegraphStateProvider>
    </ProfileGroupProvider>
  );
}
