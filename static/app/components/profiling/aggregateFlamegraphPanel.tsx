import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {DeprecatedAggregateFlamegraph} from 'sentry/components/profiling/flamegraph/deprecatedAggregateFlamegraph';
import {Flex} from 'sentry/components/profiling/flex';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DeepPartial} from 'sentry/types/utils';
import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {Frame} from 'sentry/utils/profiling/frame';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

const DEFAULT_AGGREGATE_FLAMEGRAPH_PREFERENCES: DeepPartial<FlamegraphState> = {
  preferences: {
    sorting: 'alphabetical',
    view: 'bottom up',
  },
};

class EmptyFlamegraphException extends Error {}

export function AggregateFlamegraphPanel({transaction}: {transaction: string}) {
  const {selection} = usePageFilters();
  const [hideSystemFrames, setHideSystemFrames] = useLocalStorageState(
    'profiling-flamegraph-collapsed-frames',
    true
  );

  const {data, isLoading, isError} = useAggregateFlamegraphQuery({
    transaction,
    environments: selection.environments,
    projects: selection.projects,
    datetime: selection.datetime,
  });
  const isEmpty = data?.shared.frames.length === 0;

  useEffect(() => {
    if (isLoading || isError || data.shared.frames.length > 0) {
      return;
    }
    Sentry.captureException(new EmptyFlamegraphException('Empty aggregate flamegraph'));
  }, [data, isLoading, isError]);

  return (
    <Flex column gap={space(1)}>
      <Flex align="center" gap={space(0.5)}>
        <HeaderTitle>{t('Aggregate Flamegraph')}</HeaderTitle>
        <QuestionTooltip
          size="sm"
          position="right"
          isHoverable
          title={
            <TooltipContent>
              <p>{t('An aggregate of profiles for this transaction.')}</p>
              <p>
                {t(
                  'Navigate the aggregate flamegraph by scrolling and by double clicking a frame to zoom.'
                )}
              </p>
            </TooltipContent>
          }
        />
      </Flex>
      <ProfileGroupProvider
        type="flamegraph"
        input={data ?? null}
        traceID=""
        frameFilter={hideSystemFrames ? applicationFrameOnly : undefined}
      >
        <FlamegraphStateProvider initialState={DEFAULT_AGGREGATE_FLAMEGRAPH_PREFERENCES}>
          <FlamegraphThemeProvider>
            <Panel>
              <Flex h={400} column justify="center">
                {isLoading ? (
                  <LoadingIndicator>{t('Loading Aggregate Flamegraph')}</LoadingIndicator>
                ) : isEmpty ? (
                  <EmptyStateWarning>
                    <p>{t(`Aggregate flamegraph isn't available for your query`)}</p>
                  </EmptyStateWarning>
                ) : (
                  <DeprecatedAggregateFlamegraph
                    hideSystemFrames={hideSystemFrames}
                    setHideSystemFrames={setHideSystemFrames}
                  />
                )}
              </Flex>
            </Panel>
          </FlamegraphThemeProvider>
        </FlamegraphStateProvider>
      </ProfileGroupProvider>
    </Flex>
  );
}

function applicationFrameOnly(frame: Frame): boolean {
  return frame.is_application;
}

export const HeaderTitle = styled('span')`
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export const TooltipContent = styled('div')`
  & p {
    text-align: left;
  }
  & p:last-child {
    margin-bottom: 0;
  }
`;
