import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/FullScreenFlamegraphContainer';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphThemeProvider';

function FlamegraphView() {
  return (
    <FlamegraphThemeProvider>
      <FullScreenFlamegraphContainer>{null}</FullScreenFlamegraphContainer>
    </FlamegraphThemeProvider>
  );
}

export {FlamegraphView};
