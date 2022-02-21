import {Flamegraph} from 'sentry/components/profiling/Flamegraph';
import useOrganization from 'sentry/utils/useOrganization';

function FlamegraphView() {
  // eslint-disable-next-line
  const organization = useOrganization();
  // @TODO fetch data from backend. We need to get trace.id from qs, org and projects here.

  // @ts-ignore
  return <Flamegraph />;
}

export {FlamegraphView};
