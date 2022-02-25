import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/FullScreenFlamegraphContainer';
import {FlamegraphPreferencesProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphPreferencesProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphThemeProvider';

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
