import {useCallback, useEffect, useMemo, useState} from 'react';
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
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
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

function decodeViewOrDefault(
  value: string | string[] | null | undefined,
  defaultValue: 'flamegraph' | 'profiles'
): 'flamegraph' | 'profiles' {
  if (!value || Array.isArray(value)) {
    return defaultValue;
  }
  if (value === 'flamegraph' || value === 'profiles') {
    return value;
  }
  return defaultValue;
}

interface AggregateFlamegraphToolbarProps {
  canvasPoolManager: CanvasPoolManager;
  frameFilter: 'system' | 'application' | 'all';
  hideSystemFrames: boolean;
  onFrameFilterChange: (value: 'system' | 'application' | 'all') => void;
  onHideRegressionsClick: () => void;
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
        size="xs"
        onChange={onFrameFilterChange}
        value={props.frameFilter}
        options={frameSelectOptions}
      />
    </AggregateFlamegraphToolbarContainer>
  );
}

export function LandingAggregateFlamegraph(): React.ReactNode {
  const location = useLocation();

  const {data, status} = useAggregateFlamegraphQuery({
    dataSource: 'profiles',
  });

  const [visualization, setVisualization] = useLocalStorageState<
    'flamegraph' | 'call tree'
  >('flamegraph-visualization', 'flamegraph');

  const onVisualizationChange = useCallback(
    (value: 'flamegraph' | 'call tree') => {
      setVisualization(value);
    },
    [setVisualization]
  );

  const [hideRegressions, setHideRegressions] = useLocalStorageState<boolean>(
    'flamegraph-hide-regressions',
    false
  );
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

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const [view, setView] = useState<'flamegraph' | 'profiles'>(
    decodeViewOrDefault(location.query.view, 'flamegraph')
  );

  useEffect(() => {
    const newView = decodeViewOrDefault(location.query.view, 'flamegraph');
    if (newView !== view) {
      setView(decodeViewOrDefault(location.query.view, 'flamegraph'));
    }
  }, [location.query.view, view]);

  const onHideRegressionsClick = useCallback(() => {
    return setHideRegressions(!hideRegressions);
  }, [hideRegressions, setHideRegressions]);

  return (
    <ProfileGroupProvider
      traceID=""
      type="flamegraph"
      input={data ?? null}
      frameFilter={flamegraphFrameFilter}
    >
      <FlamegraphStateProvider initialState={DEFAULT_FLAMEGRAPH_PREFERENCES}>
        <FlamegraphThemeProvider>
          <FlamegraphProvider>
            <AggregateFlamegraphContainer>
              <AggregateFlamegraphToolbar
                scheduler={scheduler}
                canvasPoolManager={canvasPoolManager}
                visualization={visualization}
                onVisualizationChange={onVisualizationChange}
                frameFilter={frameFilter}
                onFrameFilterChange={onFrameFilterChange}
                hideSystemFrames={false}
                setHideSystemFrames={noop}
                onHideRegressionsClick={onHideRegressionsClick}
              />
              {status === 'pending' ? (
                <RequestStateMessageContainer>
                  <LoadingIndicator />
                </RequestStateMessageContainer>
              ) : status === 'error' ? (
                <RequestStateMessageContainer>
                  {t('There was an error loading the flamegraph.')}
                </RequestStateMessageContainer>
              ) : null}
              {visualization === 'flamegraph' ? (
                <AggregateFlamegraphCanvasContainer>
                  <AggregateFlamegraph
                    filter={frameFilter}
                    status={status}
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
                  withoutBorders
                  frameFilter={frameFilter}
                  canvasPoolManager={canvasPoolManager}
                />
              )}
            </AggregateFlamegraphContainer>
          </FlamegraphProvider>
        </FlamegraphThemeProvider>
      </FlamegraphStateProvider>
    </ProfileGroupProvider>
  );
}

/**
 * force height to be the same as profile digest header,
 * but subtract 1px for the border that doesnt exist on the header
 */
const toolbarHeight = '41px';

const AggregateFlamegraphCanvasContainer = styled('div')`
  display: grid;
  height: calc(100% - ${toolbarHeight});
  grid-template-columns: 1fr min-content;
`;

const AggregateFlamegraphSearch = styled(FlamegraphSearch)`
  max-width: 300px;
`;

const AggregateFlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(1)} ${space(1)};
  height: ${toolbarHeight};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ViewSelectContainer = styled('div')`
  min-width: 160px;
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
`;

const AggregateFlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
  height: 100%;
  width: 100%;
  position: absolute;
  left: 0px;
  top: 0px;
`;
