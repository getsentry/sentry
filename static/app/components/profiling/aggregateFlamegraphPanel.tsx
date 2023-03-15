import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {Flex} from 'sentry/components/profiling/flex';
import {t} from 'sentry/locale';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

export function AggregateFlamegraphPanel({transaction}: {transaction: string}) {
  const {data, isLoading} = useAggregateFlamegraphQuery({transaction});
  return (
    <ProfileGroupProvider type="flamegraph" input={data ?? null} traceID="">
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
            <Flex h={400} column justify="center">
              {isLoading ? (
                <LoadingIndicator>{t('Loading Flamegraph')}</LoadingIndicator>
              ) : (
                <AggregateFlamegraph />
              )}
            </Flex>
          </Panel>
        </FlamegraphThemeProvider>
      </FlamegraphStateProvider>
    </ProfileGroupProvider>
  );
}
