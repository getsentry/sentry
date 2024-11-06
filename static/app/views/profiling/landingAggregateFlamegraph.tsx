import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {
  formatWeightToProfileDuration,
  PROFILING_SAMPLES_FORMATTER,
} from 'sentry/components/profiling/flamegraph/flamegraphTooltip';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
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
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {Frame} from 'sentry/utils/profiling/frame';
import {useAggregateFlamegraphQuery} from 'sentry/utils/profiling/hooks/useAggregateFlamegraphQuery';
import {useSourceCodeLink} from 'sentry/utils/profiling/hooks/useSourceLink';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {
  ProfileGroupProvider,
  useProfileGroup,
} from 'sentry/views/profiling/profileGroupProvider';

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
      {/*
      <Button
        size="xs"
        onClick={props.onHideRegressionsClick}
        title={t('Expand or collapse the view')}
      >
        <IconPanel size="xs" direction="right" />
      </Button>
      */}
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
                  <AggregateFlamegraphFunctionBreakdown scheduler={scheduler} />
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

interface AggregateFlamegraphFunctionBreakdownProps {
  scheduler: CanvasScheduler;
}

function AggregateFlamegraphFunctionBreakdown(
  props: AggregateFlamegraphFunctionBreakdownProps
) {
  const theme = useTheme();
  const {projects} = useProjects();
  const organization = useOrganization();
  const flamegraph = useFlamegraph();
  const profileGroup = useProfileGroup();
  const [nodes, setNodes] = useState<FlamegraphFrame[] | null>(null);

  useEffect(() => {
    function onFrameHighlight(
      frames: FlamegraphFrame[] | null,
      type: 'hover' | 'selected'
    ) {
      if (type === 'selected') {
        setNodes(frames);
      }
    }

    props.scheduler.on('highlight frame', onFrameHighlight);

    return () => {
      props.scheduler.off('highlight frame', onFrameHighlight);
    };
  }, [props.scheduler, setNodes]);

  const project = projects.find(p => p.id === String(profileGroup?.metadata?.projectID));

  const example = nodes?.[0];
  const sourceCodeLink = useSourceCodeLink({
    project,
    organization,
    commitId: profileGroup?.metadata?.release?.lastCommit?.id,
    platform: profileGroup?.metadata?.platform,
    frame: {file: example?.frame.file, path: example?.frame.path},
  });

  // @TODO: this only works for github right now, other providers will not work
  const onOpenInGithubClick = useCallback(() => {
    if (!sourceCodeLink.isSuccess) {
      return;
    }

    if (
      !sourceCodeLink.data.sourceUrl ||
      sourceCodeLink.data.config?.provider?.key !== 'github'
    ) {
      return;
    }

    // make a best effort to link to the exact line if we can
    const url = example?.frame.line
      ? `${sourceCodeLink.data.sourceUrl}#L${example.frame.line}`
      : sourceCodeLink.data.sourceUrl;

    window.open(url, '_blank', 'noopener,noreferrer');
  }, [example, sourceCodeLink]);

  const callers = useMemo(() => {
    if (!nodes) {
      return [];
    }

    const results: FlamegraphFrame[] = [];
    for (const node of nodes) {
      // Filter out the virtual root node
      if (node.parent && node.parent !== flamegraph.root) {
        results.push(node.parent);
      }
    }
    return results.sort((a, b) => b.frame.totalWeight - a.frame.totalWeight);
  }, [nodes, flamegraph.root]);

  const callees = useMemo(() => {
    if (!nodes) {
      return [];
    }

    const results: FlamegraphFrame[] = [];
    for (const node of nodes) {
      for (const child of node.children) {
        results.push(child);
      }
    }
    return results.sort((a, b) => b.frame.totalWeight - a.frame.totalWeight);
  }, [nodes]);

  const onFrameHover = useCallback(
    (frame: FlamegraphFrame) => {
      props.scheduler.dispatch('highlight frame', [frame], 'hover');
    },
    [props.scheduler]
  );

  if (!nodes) {
    return null;
  }

  if (!example) {
    return null;
  }

  const functionName = example.frame.name ?? `<unknown>`;
  const source = example.frame.file ? `${example.frame.getSourceLocation()}` : null;

  return (
    <AggregateFlamegraphFunctionBreakdownContainer>
      <AggregateFlamegraphSectionHeader>
        {t('Function Information')}
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        <AggregateFlamegraphFunctionBreakdownHeader>
          <AggregateFlamegraphFunctionName>
            <Tooltip title={functionName}>
              <TextOverflow>{functionName}</TextOverflow>
            </Tooltip>
          </AggregateFlamegraphFunctionName>
          <AggregateFlamegraphFunctionSource fontSize={theme.fontSizeMedium}>
            <TextOverflow>{source ?? '<unknown>'}</TextOverflow>
          </AggregateFlamegraphFunctionSource>
          <AggregateFlamegraphFunctionSamples>
            {PROFILING_SAMPLES_FORMATTER.format(example.frame.totalWeight)}{' '}
            {t('samples') + ' '}
            {`(${formatWeightToProfileDuration(example.node, flamegraph)})`}{' '}
          </AggregateFlamegraphFunctionSamples>
        </AggregateFlamegraphFunctionBreakdownHeader>
      </AggregateFlamegraphSection>
      <AggregateFlamegraphSectionHeader>
        {tct('Called By ([count])', {count: callers.length})}
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        {!callers.length ? (
          <AggregateFlamegraphFunctionBreakdownEmptyState>
            <Tooltip
              title={t(
                'When a function has no callers, it means that it is a root function.'
              )}
            >
              {t('No callers detected.')}
            </Tooltip>
          </AggregateFlamegraphFunctionBreakdownEmptyState>
        ) : (
          callers.map((caller, c) => (
            <div key={c} onPointerOver={() => onFrameHover(caller)}>
              {caller.frame.name}
              <AggregateFlamegraphFunctionSource fontSize={theme.fontSizeMedium}>
                <TextOverflow>{source ?? '<unknown>'}</TextOverflow>
              </AggregateFlamegraphFunctionSource>
              <AggregateFlamegraphFunctionSamples>
                {PROFILING_SAMPLES_FORMATTER.format(caller.frame.totalWeight)}{' '}
                {t('samples') + ' '}
                {`(${formatWeightToProfileDuration(caller.node, flamegraph)})`}{' '}
              </AggregateFlamegraphFunctionSamples>
            </div>
          ))
        )}
      </AggregateFlamegraphSection>
      <AggregateFlamegraphSectionHeader>
        {tct('Calls ([count])', {count: callees.length})}
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        {!callees.length ? (
          <AggregateFlamegraphFunctionBreakdownEmptyState>
            <Tooltip
              title={t(
                'When a function has no callees, it likely means that it is a leaf function, or that the profiler did not collect any samples of its callees yet.'
              )}
            >
              {t('No callees detected.')}
            </Tooltip>
          </AggregateFlamegraphFunctionBreakdownEmptyState>
        ) : (
          callees.map((callee, c) => (
            <div key={c} onPointerOver={() => onFrameHover(callee)}>
              {callee.frame.name}
              <AggregateFlamegraphFunctionSource fontSize={theme.fontSizeMedium}>
                <TextOverflow>{source ?? '<unknown>'}</TextOverflow>
              </AggregateFlamegraphFunctionSource>
              <AggregateFlamegraphFunctionSamples>
                {PROFILING_SAMPLES_FORMATTER.format(callee.frame.totalWeight)}{' '}
                {t('samples') + ' '}
                {`(${formatWeightToProfileDuration(callee.node, flamegraph)})`}{' '}
              </AggregateFlamegraphFunctionSamples>
            </div>
          ))
        )}
      </AggregateFlamegraphSection>
      <AggregateFlamegraphSectionHeader>
        {tct('Profiles ([count])', {count: example.profileIds?.length})}
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        {example.profileIds?.map((e, i) => {
          if (typeof e === 'string') {
            return <div key={i}>{e}</div>;
          }
          return <div key={i}>{'profiler_id' in e ? e.profiler_id : e.profile_id}</div>;
        })}
      </AggregateFlamegraphSection>
    </AggregateFlamegraphFunctionBreakdownContainer>
  );
}

const AggregateFlamegraphFunctionBreakdownContainer = styled('div')`
  flex-direction: column;
  width: 360px;
  border-left: 1px solid ${p => p.theme.border};
`;
const AggregateFlamegraphFunctionBreakdownHeaderRow = styled('div')<{
  fontSize?: string;
}>`
  display: flex;
  align-items: center;
  font-size: ${p => p.fontSize ?? p.theme.fontSizeSmall};
`;

const AggregateFlamegraphFunctionName = styled(
  AggregateFlamegraphFunctionBreakdownHeaderRow
)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const AggregateFlamegraphFunctionSource = styled(
  AggregateFlamegraphFunctionBreakdownHeaderRow
)`
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const AggregateFlamegraphFunctionSamples = styled(
  AggregateFlamegraphFunctionBreakdownHeaderRow
)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const AggregateFlamegraphSectionHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${space(0.5)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeightBold};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.border};
  }
`;

const AggregateFlamegraphSection = styled('div')`
  padding: ${space(1)};
`;

const AggregateFlamegraphFunctionBreakdownEmptyState = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${p => p.theme.subText};
  text-align: center;
`;

const AggregateFlamegraphFunctionBreakdownHeader = styled('div')`
  width: 100%;
`;

const AggregateFlamegraphCanvasContainer = styled('div')`
  display: grid;
  height: 100%;
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
