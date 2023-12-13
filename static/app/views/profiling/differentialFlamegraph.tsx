import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {DifferentialFlamegraph} from 'sentry/components/profiling/flamegraph/differentialFlamegraph';
import {DifferentialFlamegraphLayout} from 'sentry/components/profiling/flamegraph/differentialFlamegraphLayout';
import {DifferentialFlamegraphToolbar} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/differentialFlamegraphToolbar';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {Frame} from 'sentry/utils/profiling/frame';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useDifferentialFlamegraphModel} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphModel';
import {useDifferentialFlamegraphQuery} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphQuery';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {LOADING_PROFILE_GROUP} from 'sentry/views/profiling/profileGroupProvider';

function applicationFrameOnly(frame: Frame): boolean {
  return frame.is_application;
}

function systemFrameOnly(frame: Frame): boolean {
  return !frame.is_application;
}

function DifferentialFlamegraphView() {
  const location = useLocation();
  const selection = usePageFilters();

  const [frameFilterSetting, setFrameFilterSetting] = useState<
    'application' | 'system' | 'all'
  >('all');

  const frameFilter =
    frameFilterSetting === 'application'
      ? applicationFrameOnly
      : frameFilterSetting === 'system'
      ? systemFrameOnly
      : undefined;

  const project = useCurrentProjectFromRouteParam();

  const [negated, setNegated] = useState<boolean>(false);
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const {before, after} = useDifferentialFlamegraphQuery({
    projectID: parseInt((project?.id as string) ?? 0, 10),
    breakpoint: location.query.breakpoint as unknown as number,
    environments: selection.selection.environments,
    fingerprint: location.query.fingerprint as unknown as string,
    transaction: location.query.transaction as unknown as string,
  });

  const differentialFlamegraph = useDifferentialFlamegraphModel({
    before,
    after,
    frameFilter,
    negated,
  });

  return (
    <Feature features={['organizations:profiling-differential-flamegraph-page']}>
      <DifferentialFlamegraphContainer>
        <DifferentialFlamegraphToolbar
          frameFilter={frameFilterSetting}
          onFrameFilterChange={setFrameFilterSetting}
          negated={negated}
          onNegatedChange={setNegated}
          flamegraph={differentialFlamegraph.differentialFlamegraph}
          canvasPoolManager={canvasPoolManager}
        />
        <DifferentialFlamegraphLayout
          minimap={<Placeholder />}
          flamegraph={
            <DifferentialFlamegraph
              profileGroup={
                differentialFlamegraph.afterProfileGroup ?? LOADING_PROFILE_GROUP
              }
              differentialFlamegraph={differentialFlamegraph.differentialFlamegraph}
              canvasPoolManager={canvasPoolManager}
              scheduler={scheduler}
            />
          }
          flamegraphDrawer={<Placeholder />}
        />
      </DifferentialFlamegraphContainer>
    </Feature>
  );
}

function Placeholder() {
  return <div />;
}

const DifferentialFlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;

  ~ footer {
    display: none;
  }
`;

function DifferentialFlamegraphWithProviders() {
  return (
    <FlamegraphThemeProvider>
      <FlamegraphStateProvider
        initialState={{
          preferences: {
            sorting: 'alphabetical',
            view: 'top down',
          },
        }}
      >
        <DifferentialFlamegraphView />
      </FlamegraphStateProvider>
    </FlamegraphThemeProvider>
  );
}

export default DifferentialFlamegraphWithProviders;
