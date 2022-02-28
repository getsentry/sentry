import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {FlamegraphOptionsMenu} from 'sentry/components/profiling/flamegraphOptionsMenu';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraphSearch';
import {FlamegraphToolbar} from 'sentry/components/profiling/flamegraphToolbar';
import {FlamegraphViewSelectMenu} from 'sentry/components/profiling/flamegraphViewSelectMenu';
import {FlamegraphZoomView} from 'sentry/components/profiling/flamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/flamegraphZoomViewMinimap';
import {ProfileDragDropImport} from 'sentry/components/profiling/profileDragDropImport';
import {ThreadMenuSelector} from 'sentry/components/profiling/threadSelector';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';

interface FlamegraphProps {
  profiles: ProfileGroup;
}

function Flamegraph(props: FlamegraphProps): React.ReactElement {
  const flamegraphTheme = useFlamegraphTheme();
  const [{sorting, view}, dispatch] = useFlamegraphPreferences();
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);

  const [flamegraph, setFlamegraph] = useState(
    new FlamegraphModel(
      props.profiles.profiles[props.profiles.activeProfileIndex],
      props.profiles.activeProfileIndex,
      {
        inverted: view === 'bottom up',
        leftHeavy: sorting === 'left heavy',
      }
    )
  );

  const onImport = useCallback(
    (profile: ProfileGroup) => {
      setFlamegraph(
        new FlamegraphModel(
          profile.profiles[profile.activeProfileIndex],
          profile.activeProfileIndex,
          {
            inverted: view === 'bottom up',
            leftHeavy: sorting === 'left heavy',
          }
        )
      );
    },
    [props.profiles, view, sorting]
  );

  const onProfileIndexChange = useCallback(
    (index: number) => {
      setFlamegraph(
        new FlamegraphModel(props.profiles.profiles[index], index, {
          inverted: view === 'bottom up',
          leftHeavy: sorting === 'left heavy',
        })
      );
    },
    [props.profiles, view, sorting]
  );

  useEffect(() => {
    setFlamegraph(
      new FlamegraphModel(
        props.profiles.profiles[flamegraph.profileIndex],
        flamegraph.profileIndex,
        {
          inverted: view === 'bottom up',
          leftHeavy: sorting === 'left heavy',
        }
      )
    );
  }, [props.profiles, view, sorting]);

  return (
    <React.Fragment>
      <FlamegraphToolbar>
        <FlamegraphViewSelectMenu
          view={view}
          sorting={sorting}
          onSortingChange={s => {
            dispatch({type: 'set sorting', value: s});
          }}
          onViewChange={v => {
            dispatch({type: 'set view', value: v});
          }}
        />
        <ThreadMenuSelector
          profileGroup={props.profiles}
          activeProfileIndex={flamegraph.profileIndex}
          onProfileIndexChange={onProfileIndexChange}
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
            flamegraph={flamegraph}
            canvasPoolManager={canvasPoolManager}
          />
          <FlamegraphSearch
            placement="top"
            flamegraphs={[flamegraph]}
            canvasPoolManager={canvasPoolManager}
          />
        </ProfileDragDropImport>
      </FlamegraphZoomViewContainer>
    </React.Fragment>
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
