import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {Flex} from 'sentry/components/profiling/flex';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

export function AggregateFlamegraphPanel({transaction}: {transaction: string}) {
  const {data, isLoading} = useAggregateFlamegraphQuery({transaction});

  const isEmpty = data?.shared.frames.length === 0;
  return (
    <Flex column gap={space(1)}>
      <Flex.Item>
        <Tooltip
          showUnderline
          overlayStyle={{
            textAlign: 'unset',
          }}
          isHoverable
          title={
            <div>
              <p>{t('An aggregate of profiles for this transaction.')}</p>
              <p>
                {t(
                  'Navigate the flamegraph by scrolling and by double clicking a frame to zoom.'
                )}
              </p>
            </div>
          }
        >
          <HeaderTitle>{t('Flamegraph (?)')}</HeaderTitle>
        </Tooltip>
      </Flex.Item>
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
                ) : isEmpty ? (
                  <EmptyStateWarning>
                    <p>{t(`A flamegraph isn't available for your query`)}</p>
                  </EmptyStateWarning>
                ) : (
                  <AggregateFlamegraph />
                )}
              </Flex>
            </Panel>
          </FlamegraphThemeProvider>
        </FlamegraphStateProvider>
      </ProfileGroupProvider>
    </Flex>
  );
}

export const HeaderTitle = styled('div')`
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeSmall};
  /* text-decoration: underline dotted; */
  /* text-underline-offset: ${space(0.25)}; */
  cursor: pointer;
`;
