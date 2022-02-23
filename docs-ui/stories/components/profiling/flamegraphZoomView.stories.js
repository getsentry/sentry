import * as React from 'react';

import {FlamegraphOptionsMenu} from 'sentry/components/profiling/FlamegraphOptionsMenu';
import {FlamegraphSearch} from 'sentry/components/profiling/FlamegraphSearch';
import {FlamegraphToolbar} from 'sentry/components/profiling/FlamegraphToolbar';
import {FlamegraphViewSelectMenu} from 'sentry/components/profiling/FlamegraphViewSelectMenu';
import {FlamegraphZoomView} from 'sentry/components/profiling/FlamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/FlamegraphZoomViewMinimap';
import {ProfileDragDropImport} from 'sentry/components/profiling/ProfileDragDropImport';
import {ThreadMenuSelector} from 'sentry/components/profiling/ThreadSelector';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphThemeProvider';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';

export default {
  title: 'Components/Profiling/FlamegraphZoomView',
};

const trace = require('./EventedTrace.json');

const profiles = importProfile(trace);

export const EventedTrace = () => {
  const canvasPoolManager = new CanvasPoolManager();

  const [colorCoding, setColorCoding] = React.useState('by symbol name');
  const [highlightRecursion, setHighlightRecursion] = React.useState(false);
  const [view, setView] = React.useState({inverted: false, leftHeavy: false});
  const [flamegraph, setFlamegraph] = React.useState(
    new Flamegraph(profiles.profiles[0], 0, view.inverted, view.leftHeavy)
  );

  const onImport = React.useCallback(
    profile => {
      setFlamegraph(
        new Flamegraph(profile.profiles[0], 0, view.inverted, view.leftHeavy)
      );
    },
    [view.inverted, view.leftHeavy]
  );

  const onProfileIndexChange = React.useCallback(
    index => {
      setFlamegraph(
        new Flamegraph(profiles.profiles[index], index, view.inverted, view.leftHeavy)
      );
    },
    [view.inverted, view.leftHeavy]
  );

  React.useEffect(() => {
    setFlamegraph(new Flamegraph(profiles.profiles[0], 0, view.inverted, view.leftHeavy));
  }, [view.inverted, view.leftHeavy]);

  return (
    <FlamegraphThemeProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: `100vh`,
          overflow: 'hidden',
          overscrollBehavior: 'contain',
        }}
      >
        <FlamegraphToolbar>
          <FlamegraphViewSelectMenu
            view={view.inverted ? 'bottom up' : 'top down'}
            sorting={view.leftHeavy ? 'left heavy' : 'call order'}
            onSortingChange={s => {
              setView({...view, leftHeavy: s === 'left heavy'});
            }}
            onViewChange={v => {
              setView({...view, inverted: v === 'bottom up'});
            }}
          />
          <ThreadMenuSelector
            profileGroup={profiles}
            activeProfileIndex={flamegraph.profileIndex}
            onProfileIndexChange={onProfileIndexChange}
          />
          <FlamegraphOptionsMenu
            colorCoding={colorCoding}
            onColorCodingChange={setColorCoding}
            highlightRecursion={highlightRecursion}
            onHighlightRecursionChange={setHighlightRecursion}
            canvasPoolManager={canvasPoolManager}
          />
        </FlamegraphToolbar>
        <div style={{height: 100, position: 'relative'}}>
          <FlamegraphZoomViewMinimap
            flamegraph={flamegraph}
            highlightRecursion={highlightRecursion}
            colorCoding={colorCoding}
            canvasPoolManager={canvasPoolManager}
          />
        </div>
        <div style={{position: 'relative', flex: '1 1 0%'}}>
          <ProfileDragDropImport onImport={onImport}>
            <FlamegraphZoomView
              flamegraph={flamegraph}
              highlightRecursion={highlightRecursion}
              colorCoding={colorCoding}
              canvasPoolManager={canvasPoolManager}
            />
            <FlamegraphSearch
              flamegraphs={[flamegraph]}
              canvasPoolManager={canvasPoolManager}
            />
          </ProfileDragDropImport>
        </div>
      </div>
    </FlamegraphThemeProvider>
  );
};
