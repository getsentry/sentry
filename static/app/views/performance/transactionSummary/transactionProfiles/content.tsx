import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import {Flex} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AggregateFlamegraph} from 'sentry/components/profiling/flamegraph/aggregateFlamegraph';
import {AggregateFlamegraphSidePanel} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphSidePanel';
import {AggregateFlamegraphTreeTable} from 'sentry/components/profiling/flamegraph/aggregateFlamegraphTreeTable';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DeepPartial} from 'sentry/types/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
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
import useOrganization from 'sentry/utils/useOrganization';
import {
  FlamegraphProvider,
  useFlamegraph,
} from 'sentry/views/profiling/flamegraphProvider';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';

const PROFILE_TYPE = 'transaction aggregate flamegraph';

const DEFAULT_FLAMEGRAPH_PREFERENCES: DeepPartial<FlamegraphState> = {
  preferences: {
    sorting: 'left heavy' satisfies FlamegraphState['preferences']['sorting'],
  },
};

const noop = () => void 0;

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

interface TransactionProfilesContentProps {
  query: string;
  transaction: string;
}

export function TransactionProfilesContent(props: TransactionProfilesContentProps) {
  const organization = useOrganization();
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
      return (frame: Frame) => frame.is_application;
    }
    return (frame: Frame) => !frame.is_application;
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

  const [showSidePanel, setShowSidePanel] = useState(true);

  const initial = useRef(true);

  useEffect(() => {
    trackAnalytics('profiling_views.aggregate_profile_flamegraph', {
      organization,
      profile_type: 'transaction aggregate flamegraph',
      frame_filter: frameFilter,
      visualization,
      render: initial.current ? 'initial' : 're-render',
    });

    initial.current = false;
  }, [organization, frameFilter, visualization]);

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
            <TransactionProfilesContentContainer>
              <ProfileVisualizationContainer>
                <AggregateFlamegraphToolbar
                  scheduler={scheduler}
                  canvasPoolManager={canvasPoolManager}
                  visualization={visualization}
                  onVisualizationChange={onVisualizationChange}
                  frameFilter={frameFilter}
                  onFrameFilterChange={onFrameFilterChange}
                  hideSystemFrames={false}
                  setHideSystemFrames={noop}
                  expanded={showSidePanel}
                  setExpanded={setShowSidePanel}
                />
                <Flex>
                  {visualization === 'flamegraph' ? (
                    <AggregateFlamegraph
                      status={status}
                      filter={frameFilter}
                      onResetFilter={onResetFrameFilter}
                      canvasPoolManager={canvasPoolManager}
                      scheduler={scheduler}
                      profileType={PROFILE_TYPE}
                    />
                  ) : (
                    <AggregateFlamegraphTreeTable
                      recursion={null}
                      expanded={false}
                      frameFilter={frameFilter}
                      canvasPoolManager={canvasPoolManager}
                      withoutBorders
                      profileType={PROFILE_TYPE}
                    />
                  )}
                </Flex>
                {status === 'pending' ? (
                  <RequestStateMessageContainer>
                    <LoadingIndicator />
                  </RequestStateMessageContainer>
                ) : status === 'error' ? (
                  <RequestStateMessageContainer>
                    {t('There was an error loading the flamegraph.')}
                  </RequestStateMessageContainer>
                ) : isEmpty(data) && visualization !== 'flamegraph' ? (
                  <RequestStateMessageContainer>
                    {t('No profiling data found')}
                  </RequestStateMessageContainer>
                ) : null}
              </ProfileVisualizationContainer>
              <AggregateFlamegraphSidePanelContainer visible={showSidePanel}>
                <AggregateFlamegraphSidePanel scheduler={scheduler} />
              </AggregateFlamegraphSidePanelContainer>
            </TransactionProfilesContentContainer>
          </FlamegraphProvider>
        </FlamegraphThemeProvider>
      </FlamegraphStateProvider>
    </ProfileGroupProvider>
  );
}

interface AggregateFlamegraphToolbarProps {
  canvasPoolManager: CanvasPoolManager;
  expanded: boolean;
  frameFilter: 'system' | 'application' | 'all';
  hideSystemFrames: boolean;
  onFrameFilterChange: (value: 'system' | 'application' | 'all') => void;
  onVisualizationChange: (value: 'flamegraph' | 'call tree') => void;
  scheduler: CanvasScheduler;
  setExpanded: (expanded: boolean) => void;
  setHideSystemFrames: (value: boolean) => void;
  visualization: 'flamegraph' | 'call tree';
}

function AggregateFlamegraphToolbar(props: AggregateFlamegraphToolbarProps) {
  const organization = useOrganization();
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
    trackAnalytics('profiling_views.aggregate_flamegraph.zoom.reset', {
      organization,
      profile_type: 'transaction aggregate flamegraph',
    });
  }, [props.scheduler, organization]);

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
      <CollapseExpandButtonContainer>
        <CollapseExpandButton
          aria-label={props.expanded ? t('Collapse sidebar') : t('Expande sidebar')}
          size="xs"
          icon={<IconDoubleChevron direction={props.expanded ? 'right' : 'left'} />}
          onClick={() => props.setExpanded(!props.expanded)}
        />
      </CollapseExpandButtonContainer>
    </AggregateFlamegraphToolbarContainer>
  );
}

const CollapseExpandButtonContainer = styled('div')`
  width: 28px;
`;

const CollapseExpandButton = styled(Button)`
  width: 28px;
  margin-right: -9px;
  border-right: 0px;
  border-top-right-radius: 0px;
  border-bottom-right-radius: 0px;
`;

function IconDoubleChevron(props: React.ComponentProps<typeof IconChevron>) {
  return (
    <Flex>
      <IconChevron style={{marginRight: `-3px`}} {...props} />
      <IconChevron style={{marginLeft: `-3px`}} {...props} />
    </Flex>
  );
}

const TransactionProfilesContentContainer = styled('div')`
  display: grid;
  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: 'visualization digest';
  grid-template-columns: 1fr min-content;
  flex: 1;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  max-height: 85vh;
`;

const ProfileVisualizationContainer = styled('div')`
  grid-area: visualization;
  display: grid;
  grid-template-rows: min-content 1fr;
  height: 100%;
  position: relative;
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
  /*
    force height to be the same as profile digest header,
    but subtract 1px for the border that doesnt exist on the header
   */
  height: 41px;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const ViewSelectContainer = styled('div')`
  min-width: 160px;
`;

const AggregateFlamegraphSearch = styled(FlamegraphSearch)`
  max-width: 300px;
`;

const AggregateFlamegraphSidePanelContainer = styled('div')<{visible: boolean}>`
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
  overflow-y: scroll;
  ${p => !p.visible && 'display: none;'}
`;
