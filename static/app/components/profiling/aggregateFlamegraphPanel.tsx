import {useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {Flex} from 'sentry/components/profiling/flex';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

export function AggregateFlamegraphPanel({transaction}: {transaction: string}) {
  const {data, isLoading} = useAggregateFlamegraphQuery({transaction});
  const {
    selection: {projects},
  } = usePageFilters();

  const isEmpty = data?.shared.frames.length === 0;

  const profileGroupInput = useMemo(() => {
    if (!data) {
      return null;
    }

    // TODO: this is a hack and should be coming from `vroom`
    // without this our contextMenu links don't work
    const profileGroupWithprofileId: Profiling.Schema = {
      ...data,
      metadata: {
        ...data.metadata,
        // without this our contextMenu links don't work
        projectID: projects[0],
      },
    };

    return profileGroupWithprofileId;
  }, [data, projects]);
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
      <ProfileGroupProvider type="flamegraph" input={profileGroupInput} traceID="">
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
