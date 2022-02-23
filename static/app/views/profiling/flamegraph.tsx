import {Flamegraph} from 'sentry/components/profiling/Flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/FullScreenFlamegraphContainer';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphThemeProvider';

function FlamegraphView() {
  return (
    <FlamegraphThemeProvider>
      <FullScreenFlamegraphContainer>
        {/* @ts-ignore */}
        <Flamegraph profiles={} />
      </FullScreenFlamegraphContainer>
    </FlamegraphThemeProvider>
  );
}

export {FlamegraphView};
