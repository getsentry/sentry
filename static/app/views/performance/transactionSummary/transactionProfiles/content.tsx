import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {AggregateFlamegraphSampleTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphSampleTable';
import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DeepPartial} from 'sentry/types/utils';
import type {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import type {Frame} from 'sentry/utils/profiling/frame';
import {isEventedProfile, isSampledProfile} from 'sentry/utils/profiling/guards/profile';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

const DEFAULT_FLAMEGRAPH_PREFERENCES: DeepPartial<FlamegraphState> = {
  preferences: {
    sorting: 'left heavy' satisfies FlamegraphState['preferences']['sorting'],
  },
};

const noop = () => void 0;

interface TransactionProfilesContentProps {
  query: string;
  transaction: string;
}

export function TransactionProfilesContent(props: TransactionProfilesContentProps) {
  return (
    <TransactionProfilesContentContainer>
      <ProfileVisualization {...props} />
    </TransactionProfilesContentContainer>
  );
}

function isEmpty(resp: Profiling.Schema) {
  const profile = resp.profiles[0];
  if (!profile) {
    return true;
  }
  if (
    resp.profiles.length === 1 &&
    isSampledProfile(profile) &&
    profile.startValue === 0 &&
    profile.endValue === 0
  ) {
    return true;
  }
  if (
    resp.profiles.length === 1 &&
    isEventedProfile(profile) &&
    profile.startValue === 0 &&
    profile.endValue === 0
  ) {
    return true;
  }
  return false;
}

function ProfileVisualization(props: TransactionProfilesContentProps) {
  const {data, status} = useAggregateFlamegraphQuery({
    query: props.query,
  });

  const [frameFilter, setFrameFilter] = useLocalStorageState<
    'system' | 'application' | 'all'
  >('flamegraph-frame-filter', 'application');

  const onFrameFilterChange = useCallback(
    (value: 'system' | 'application' | 'all') => {
      setFrameFilter(value);
    },
    [setFrameFilter]
  );

  const onResetFrameFilter = useCallback(() => {
    setFrameFilter('all');
  }, [setFrameFilter]);

  const flamegraphFrameFilter: ((frame: Frame) => boolean) | undefined = useMemo(() => {
    if (frameFilter === 'all') {
      return () => true;
    }
    if (frameFilter === 'application') {
      return frame => frame.is_application;
    }
    return frame => !frame.is_application;
  }, [frameFilter]);

  const [visualization, setVisualization] = useLocalStorageState<
    'flamegraph' | 'call tree'
  >('flamegraph-visualization', 'flamegraph');

  const onVisualizationChange = useCallback(
    (value: 'flamegraph' | 'call tree') => {
      setVisualization(value);
    },
    [setVisualization]
  );

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  return (
    <ProfileVisualizationContainer>
      <ProfileGroupProvider
        traceID=""
        type="flamegraph"
        input={data ?? null}
        frameFilter={flamegraphFrameFilter}
      >
        <FlamegraphStateProvider initialState={DEFAULT_FLAMEGRAPH_PREFERENCES}>
          <FlamegraphThemeProvider>
            <FlamegraphProvider>
              <AggregateFlamegraphToolbar
                scheduler={scheduler}
                canvasPoolManager={canvasPoolManager}
                visualization={visualization}
                onVisualizationChange={onVisualizationChange}
                frameFilter={frameFilter}
                onFrameFilterChange={onFrameFilterChange}
                hideSystemFrames={false}
                setHideSystemFrames={noop}
              />
              <FlamegraphContainer>
                {visualization === 'flamegraph' ? (
                  <AggregateFlamegraphCanvasContainer>
                    <AggregateFlamegraph
                      status={status}
                      filter={frameFilter}
                      onResetFilter={onResetFrameFilter}
                      canvasPoolManager={canvasPoolManager}
                      scheduler={scheduler}
                    />
                    <AggregateFlamegraphSampleTable scheduler={scheduler} />
                  </AggregateFlamegraphCanvasContainer>
                ) : (
                  <AggregateFlamegraphTreeTable
                    recursion={null}
                    expanded={false}
                    frameFilter={frameFilter}
                    canvasPoolManager={canvasPoolManager}
                    withoutBorders
                  />
                )}
              </FlamegraphContainer>
              {status === 'pending' ? (
                <RequestStateMessageContainer>
                  <LoadingIndicator />
                </RequestStateMessageContainer>
              ) : status === 'error' ? (
                <RequestStateMessageContainer>
                  {t('There was an error loading the flamegraph.')}
                </RequestStateMessageContainer>
              ) : isEmpty(data) ? (
                <RequestStateMessageContainer>
                  {t('No profiling data found')}
                </RequestStateMessageContainer>
              ) : null}
            </FlamegraphProvider>
          </FlamegraphThemeProvider>
        </FlamegraphStateProvider>
      </ProfileGroupProvider>
    </ProfileVisualizationContainer>
  );
}

interface AggregateFlamegraphToolbarProps {
  canvasPoolManager: CanvasPoolManager;
  frameFilter: 'system' | 'application' | 'all';
  hideSystemFrames: boolean;
  onFrameFilterChange: (value: 'system' | 'application' | 'all') => void;
  onVisualizationChange: (value: 'flamegraph' | 'call tree') => void;
  scheduler: CanvasScheduler;
  setHideSystemFrames: (value: boolean) => void;
  visualization: 'flamegraph' | 'call tree';
}

function AggregateFlamegraphToolbar(props: AggregateFlamegraphToolbarProps) {
  const flamegraph = useFlamegraph();
  const flamegraphs = useMemo(() => [flamegraph], [flamegraph]);
  const spans = useMemo(() => [], []);

  const frameSelectOptions: Array<SelectOption<'system' | 'application' | 'all'>> =
    useMemo(() => {
      return [
        {value: 'system', label: t('System Frames')},
        {value: 'application', label: t('Application Frames')},
        {value: 'all', label: t('All Frames')},
      ];
    }, []);

  const onResetZoom = useCallback(() => {
    props.scheduler.dispatch('reset zoom');
  }, [props.scheduler]);

  const onFrameFilterChange = useCallback(
    (value: {value: 'application' | 'system' | 'all'}) => {
      props.onFrameFilterChange(value.value);
    },
    [props]
  );

  return (
    <AggregateFlamegraphToolbarContainer>
      <ViewSelectContainer>
        <SegmentedControl
          aria-label={t('View')}
          size="xs"
          value={props.visualization}
          onChange={props.onVisualizationChange}
        >
          <SegmentedControl.Item key="flamegraph">
            {t('Flamegraph')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="call tree">{t('Call Tree')}</SegmentedControl.Item>
        </SegmentedControl>
      </ViewSelectContainer>
      <AggregateFlamegraphSearch
        spans={spans}
        canvasPoolManager={props.canvasPoolManager}
        flamegraphs={flamegraphs}
      />
      <Button size="xs" onClick={onResetZoom}>
        {t('Reset Zoom')}
      </Button>
      <CompactSelect
        onChange={onFrameFilterChange}
        value={props.frameFilter}
        size="xs"
        options={frameSelectOptions}
      />
    </AggregateFlamegraphToolbarContainer>
  );
}

const TransactionProfilesContentContainer = styled('div')`
  display: grid;
  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: 'visualization digest';
  grid-template-columns: 1fr min-content;
  flex: 1;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const ProfileVisualizationContainer = styled('div')`
  grid-area: visualization;
  display: grid;
  grid-template-rows: min-content 1fr;
  height: 100%;
  position: relative;
`;

const FlamegraphContainer = styled('div')`
  display: flex;
`;

const RequestStateMessageContainer = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
  pointer-events: none;
`;

const AggregateFlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(1)};
  background-color: ${p => p.theme.background};
  /*
    force height to be the same as profile digest header,
    but subtract 1px for the border that doesnt exist on the header
   */
  height: 41px;
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0px 0px;
`;

const ViewSelectContainer = styled('div')`
  min-width: 160px;
`;

const AggregateFlamegraphSearch = styled(FlamegraphSearch)`
  max-width: 300px;
`;

const AggregateFlamegraphCanvasContainer = styled('div')`
  display: grid;
  width: 100%;
  height: 100%;
  grid-template-columns: 1fr min-content;
`;
