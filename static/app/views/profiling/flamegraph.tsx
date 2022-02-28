import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/fullScreenFlamegraphContainer';
import {FlamegraphPreferencesProvider} from 'sentry/utils/profiling/flamegraph/flamegraphPreferencesProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';

function FlamegraphView() {
  return (
    <FlamegraphThemeProvider>
      <FlamegraphPreferencesProvider>
        <FullScreenFlamegraphContainer>{null}</FullScreenFlamegraphContainer>
      </FlamegraphPreferencesProvider>
    </FlamegraphThemeProvider>
  );
}

export default FlamegraphView;
