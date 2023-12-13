import Feature from 'sentry/components/acl/feature';

function DifferentialFlamegraph() {
  return (
    <Feature features={['organizations:profiling-differential-flamegraph-page']}>
      Differential Flamegraph
    </Feature>
  );
}

export default DifferentialFlamegraph;
