import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {Flex} from 'sentry/components/profiling/flex';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {useAggregateFlamegraphQuery} from 'sentry/domains/profiling/hooks/useAggregateFlamegraphQuery';
import {FlamegraphStateProvider} from 'sentry/domains/profiling/providers/flamegraphStateProvider/flamegraphContextProvider';
import {ProfileGroupProvider} from 'sentry/domains/profiling/providers/profileGroupProvider';
import {FlamegraphThemeProvider} from 'sentry/domains/profiling/providers/flamegraphThemeProvider';
import {Frame} from 'sentry/domains/profiling/utils/profiling/frame';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export function AggregateFlamegraphPanel({transaction}: {transaction: string}) {
  const [hideSystemFrames, setHideSystemFrames] = useLocalStorageState(
    'profiling-flamegraph-collapsed-frames',
    true
  );

  const {data, isLoading} = useAggregateFlamegraphQuery({transaction});

  const isEmpty = data?.shared.frames.length === 0;

  return (
    <Flex column gap={space(1)}>
      <Flex align="center" gap={space(0.5)}>
        <HeaderTitle>{t('Flamegraph')}</HeaderTitle>
        <QuestionTooltip
          size="sm"
          position="right"
          isHoverable
          title={
            <TooltipContent>
              <p>{t('An aggregate of profiles for this transaction.')}</p>
              <p>
                {t(
                  'Navigate the flamegraph by scrolling and by double clicking a frame to zoom.'
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
                  <AggregateFlamegraph
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
