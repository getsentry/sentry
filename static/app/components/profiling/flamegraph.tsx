import {Fragment, ReactElement, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {FlamegraphOptionsMenu} from 'sentry/components/profiling/flamegraphOptionsMenu';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraphSearch';
import {FlamegraphToolbar} from 'sentry/components/profiling/flamegraphToolbar';
import {FlamegraphViewSelectMenu} from 'sentry/components/profiling/flamegraphViewSelectMenu';
import {FlamegraphZoomView} from 'sentry/components/profiling/flamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/flamegraphZoomViewMinimap';
import {
  ProfileDragDropImport,
  ProfileDragDropImportProps,
} from 'sentry/components/profiling/profileDragDropImport';
import {ThreadMenuSelector} from 'sentry/components/profiling/threadSelector';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';

function getTransactionConfigSpace(profiles: Profile[]): Rect {
  const startedAt = Math.min(...profiles.map(p => p.startedAt));
  const endedAt = Math.max(...profiles.map(p => p.endedAt));
  return new Rect(startedAt, 0, endedAt - startedAt, 0);
}
interface FlamegraphProps {
  onImport: ProfileDragDropImportProps['onImport'];
  profiles: ProfileGroup;
}

function Flamegraph(props: FlamegraphProps): ReactElement {
  const flamegraphTheme = useFlamegraphTheme();
  const [{sorting, view, synchronizeXAxisWithTransaction}, dispatch] =
    useFlamegraphPreferences();
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);

  const [activeProfileIndex, setActiveProfileIndex] = useState<number>(
    props.profiles.activeProfileIndex
  );

  const flamegraph = useMemo(() => {
    return new FlamegraphModel(
      props.profiles.profiles[activeProfileIndex],
      activeProfileIndex,
      {
        inverted: view === 'bottom up',
        leftHeavy: sorting === 'left heavy',
        configSpace: synchronizeXAxisWithTransaction
          ? getTransactionConfigSpace(props.profiles.profiles)
          : undefined,
      }
    );
  }, [
    props.profiles,
    activeProfileIndex,
    sorting,
    synchronizeXAxisWithTransaction,
    view,
  ]);

  // We wrap the onImport callback and reset the activeProfileIndex when new profiles are imported.
  const onImport: ProfileDragDropImportProps['onImport'] = useCallback(
    profiles => {
      setActiveProfileIndex(profiles.activeProfileIndex);
      props.onImport(profiles);
    },
    [props.onImport]
  );

  return (
    <Fragment>
      <FlamegraphToolbar>
        <ThreadMenuSelector
          profileGroup={props.profiles}
          activeProfileIndex={flamegraph.profileIndex}
          onProfileIndexChange={setActiveProfileIndex}
        />
        <FlamegraphViewSelectMenu
          view={view}
          sorting={sorting}
          onSortingChange={s => {
            dispatch({type: 'set sorting', payload: s});
          }}
          onViewChange={v => {
            dispatch({type: 'set view', payload: v});
          }}
        />
        <FlamegraphSearch
          flamegraphs={[flamegraph]}
          canvasPoolManager={canvasPoolManager}
        />
        <FlamegraphOptionsMenu canvasPoolManager={canvasPoolManager} />
      </FlamegraphToolbar>

      <FlamegraphZoomViewMinimapContainer height={flamegraphTheme.SIZES.MINIMAP_HEIGHT}>
        <FlamegraphZoomViewMinimap
          flamegraph={flamegraph}
          canvasPoolManager={canvasPoolManager}
        />
      </FlamegraphZoomViewMinimapContainer>
      <FlamegraphZoomViewContainer>
        <ProfileDragDropImport onImport={onImport}>
          <FlamegraphZoomView
            key={`${props.profiles.traceID}-${flamegraph.profileIndex}`}
            flamegraph={flamegraph}
            canvasPoolManager={canvasPoolManager}
          />
        </ProfileDragDropImport>
      </FlamegraphZoomViewContainer>
    </Fragment>
  );
}

const FlamegraphZoomViewMinimapContainer = styled('div')<{
  height: FlamegraphTheme['SIZES']['MINIMAP_HEIGHT'];
}>`
  position: relative;
  height: ${p => p.height}px;
  flex-shrink: 0;
`;

const FlamegraphZoomViewContainer = styled('div')`
  position: relative;
  flex: 1 1 100%;
`;

export {Flamegraph};
