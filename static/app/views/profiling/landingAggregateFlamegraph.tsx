import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import TextOverflow from 'sentry/components/textOverflow';
import {IconChevron, IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DeepPartial} from 'sentry/types/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import type {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphState} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContext';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {Frame} from 'sentry/utils/profiling/frame';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

import {useMemoryPagination} from './landing/slowestFunctionsTable';

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

interface SlowestFlamegraphFrame {
  aggregate: {
    selfWeight: number;
    totalWeight: number;
  };
  frame: FlamegraphFrame['frame'];
  instances: CallTreeNode[];
}

function sortByTotalWeight(a: SlowestFlamegraphFrame, b: SlowestFlamegraphFrame) {
  return b.aggregate.totalWeight - a.aggregate.totalWeight;
}

function getSlowestFlamegraphFrames(flamegraph: Flamegraph): SlowestFlamegraphFrame[] {
  const results: Map<FlamegraphFrame['frame'], SlowestFlamegraphFrame> = new Map();

  for (const frame of flamegraph.frames) {
    const result = results.get(frame.frame) ?? {
      aggregate: {selfWeight: 0, totalWeight: 0},
      instances: [],
      frame: frame.frame,
    };
    result.aggregate.selfWeight += frame.node.selfWeight;
    result.aggregate.totalWeight += frame.node.totalWeight;
    result.instances.push(frame.node);
    results.set(frame.frame, result);
  }

  return Array.from(results.values());
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

  const frameSelectOptions: SelectOption<'system' | 'application' | 'all'>[] =
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
      <Button
        size="xs"
        onClick={props.onHideRegressionsClick}
        title={t('Expand or collapse the view')}
      >
        <IconPanel size="xs" direction="right" />
      </Button>
    </AggregateFlamegraphToolbarContainer>
  );
}

function LandingAggregaterFlamegraphFunctionBreakdown() {
  const flamegraph = useFlamegraph();

  const slowestFlamegraphFrames = useMemo(() => {
    return getSlowestFlamegraphFrames(flamegraph).sort(sortByTotalWeight);
  }, [flamegraph]);

  const pagination = useMemoryPagination(slowestFlamegraphFrames, 20);

  const paginatedSlowestFrames = useMemo(() => {
    return slowestFlamegraphFrames.slice(pagination.start, pagination.end);
  }, [slowestFlamegraphFrames, pagination.start, pagination.end]);

  return (
    <AggregateFlamegraphFunctionsBreakdownContainer>
      <BreakdownTitle>{t('Functions')}</BreakdownTitle>
      <FunctionsScrollableContainer>
        <FunctionList>
          {paginatedSlowestFrames.map((frame, index) => (
            <FunctionListItem key={index}>
              <FunctionInfo>
                <TextOverflow>
                  <FunctionName>{frame.frame.name}</FunctionName>
                  {(frame.frame.package || frame.frame.module) && (
                    <FunctionPackage>
                      {' '}
                      ({frame.frame.package || frame.frame.module})
                    </FunctionPackage>
                  )}
                </TextOverflow>
              </FunctionInfo>
              <Metric>
                {t('Samples')}: {formatAbbreviatedNumber(frame.aggregate.totalWeight)}
                {' | '}
                {t('Instances')}: {frame.instances.length}
              </Metric>
            </FunctionListItem>
          ))}
        </FunctionList>
      </FunctionsScrollableContainer>
      <FunctionsPaginationContainer>
        <ButtonBar merged>
          <Button
            icon={<IconChevron direction="left" />}
            aria-label={t('Previous')}
            size={'sm'}
            {...pagination.previousButtonProps}
          />
          <Button
            icon={<IconChevron direction="right" />}
            aria-label={t('Next')}
            size={'sm'}
            {...pagination.nextButtonProps}
          />
        </ButtonBar>
      </FunctionsPaginationContainer>
    </AggregateFlamegraphFunctionsBreakdownContainer>
  );
}

export function LandingAggregateFlamegraph(): React.ReactNode {
  const location = useLocation();

  const {data, isPending, isError} = useAggregateFlamegraphQuery({
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
              <FlamegraphAndBreakdownContainer>
                <FlamegraphContainer>
                  {isPending ? (
                    <RequestStateMessageContainer>
                      <LoadingIndicator />
                    </RequestStateMessageContainer>
                  ) : isError ? (
                    <RequestStateMessageContainer>
                      {t('There was an error loading the flamegraph.')}
                    </RequestStateMessageContainer>
                  ) : null}
                  {visualization === 'flamegraph' ? (
                    <AggregateFlamegraph
                      canvasPoolManager={canvasPoolManager}
                      scheduler={scheduler}
                    />
                  ) : (
                    <AggregateFlamegraphTreeTable
                      recursion={null}
                      expanded={false}
                      withoutBorders
                      frameFilter={frameFilter}
                      canvasPoolManager={canvasPoolManager}
                    />
                  )}
                </FlamegraphContainer>
                <LandingAggregaterFlamegraphFunctionBreakdown />
              </FlamegraphAndBreakdownContainer>
            </AggregateFlamegraphContainer>
          </FlamegraphProvider>
        </FlamegraphThemeProvider>
      </FlamegraphStateProvider>
    </ProfileGroupProvider>
  );
}

const AggregateFlamegraphFunctionsBreakdownContainer = styled('div')`
  flex: 1;
  min-width: 360px;
  border-left: 1px solid ${p => p.theme.border};
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: min-content 1fr min-content;
`;

const FunctionsScrollableContainer = styled('div')`
  position: relative;
  overflow-y: auto;
`;

const FunctionList = styled('ul')`
  list-style-type: none;
  margin: 0;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  padding: ${space(1)};
`;

const FunctionsPaginationContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(1)};
`;

const FunctionListItem = styled('li')`
  margin-bottom: ${space(1.5)};
`;

const FunctionInfo = styled('div')`
  display: flex;
  align-items: baseline;
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const FunctionName = styled('span')`
  /* No additional styling needed */
`;

const FunctionPackage = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin-left: ${space(0.5)};
`;

const Metric = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const AggregateFlamegraphSearch = styled(FlamegraphSearch)`
  max-width: 300px;
`;

const AggregateFlamegraphToolbarContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  padding: ${space(1)} ${space(1)};
  /*
    force height to be the same as profile digest header,
    but subtract 1px for the border that doesnt exist on the header
   */
  height: 41px;
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
  overflow: hidden;
  position: absolute;
  left: 0px;
  top: 0px;
`;

const FlamegraphAndBreakdownContainer = styled('div')`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const FlamegraphContainer = styled('div')`
  flex: 2;
  position: relative;
  overflow: hidden;
`;

const BreakdownTitle = styled('h4')`
  font-size: ${p => p.theme.fontSizeMedium};
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: 0;
  padding: ${space(1)};
  font-weight: 600;
`;
