import {Flamegraph} from 'sentry/components/profiling/Flamegraph';
import {FullScreenFlamegraphContainer} from 'sentry/components/profiling/FullScreenFlamegraphContainer';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/FlamegraphThemeProvider';
import useOrganization from 'sentry/utils/useOrganization';

function FlamegraphView() {
  // eslint-disable-next-line
  const organization = useOrganization();
  // @TODO fetch data from backend. We need to get trace.id from qs, org and projects here.

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
