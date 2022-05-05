import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {useParams} from 'sentry/utils/useParams';

import Flamegraph from './flamegraph';
import FlamegraphSummary from './flamegraphSummary';

function FlamegraphView() {
  const params = useParams();

  if (params.flamegraphTab === 'flamegraph') {
    return <Flamegraph />;
  }
  if (params.flamegraphTab === 'summary') {
    return <FlamegraphSummary />;
  }

  return (
    <EmptyStateWarning>
      <p>
        Someone shared a bad link with you, there in no way we could we have forgetten
        about some legacy url somewhere, it cant be.
      </p>
    </EmptyStateWarning>
  );
}

export default FlamegraphView;
