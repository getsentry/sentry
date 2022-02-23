import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {FlamegraphOptionsMenu} from 'sentry/components/profiling/FlamegraphOptionsMenu';
import {FlamegraphSearch} from 'sentry/components/profiling/FlamegraphSearch';
import {FlamegraphToolbar} from 'sentry/components/profiling/FlamegraphToolbar';
import {FlamegraphViewSelectMenu} from 'sentry/components/profiling/FlamegraphViewSelectMenu';
import {FlamegraphZoomView} from 'sentry/components/profiling/FlamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/FlamegraphZoomViewMinimap';
import {ProfileDragDropImport} from 'sentry/components/profiling/ProfileDragDropImport';
import {ThreadMenuSelector} from 'sentry/components/profiling/ThreadSelector';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';

interface FlamegraphProps {
  profiles: ProfileGroup;
}

function Flamegraph(props: FlamegraphProps): React.ReactElement {
  const flamegraphTheme = useFlamegraphTheme();
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const [{sorting, view, colorCoding}, dispatch] = useFlamegraphPreferences();

  const [flamegraph, setFlamegraph] = useState(
    new FlamegraphModel(
      props.profiles.profiles[props.profiles.activeProfileIndex],
      0,
      view === 'bottom up',
      sorting === 'left heavy'
    )
  );

  const onImport = useCallback(
    profile => {
      setFlamegraph(
        new FlamegraphModel(
          profile.profiles[0],
          0,
          view === 'bottom up',
          sorting === 'left heavy'
        )
      );
    },
    [props.profiles, view, sorting]
  );

  const onProfileIndexChange = useCallback(
    index => {
      setFlamegraph(
        new FlamegraphModel(
          props.profiles.profiles[index],
          index,
          view === 'bottom up',
          sorting === 'left heavy'
        )
      );
    },
    [props.profiles, view, sorting]
  );

  useEffect(() => {
    setFlamegraph(
      new FlamegraphModel(
        props.profiles.profiles[0],
        0,
        view === 'bottom up',
        sorting === 'left heavy'
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
        <FlamegraphOptionsMenu
          colorCoding={colorCoding}
          onColorCodingChange={c => dispatch({type: 'set color coding', value: c})}
          canvasPoolManager={canvasPoolManager}
        />
      </FlamegraphToolbar>

      <FlamegraphZoomViewMinimapContainer height={flamegraphTheme.SIZES.MINIMAP_HEIGHT}>
        <FlamegraphZoomViewMinimap
          flamegraph={flamegraph}
          colorCoding={colorCoding}
          canvasPoolManager={canvasPoolManager}
        />
      </FlamegraphZoomViewMinimapContainer>
      <FlamegraphZoomViewContainer>
        <ProfileDragDropImport onImport={onImport}>
          <FlamegraphZoomView
            flamegraph={flamegraph}
            colorCoding={colorCoding}
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
  height: ${p => p.height};
`;

const FlamegraphZoomViewContainer = styled('div')`
  position: relative;
  flex: 1 1 100%;
`;

export {Flamegraph};
