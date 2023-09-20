import React from 'react';

import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import A11y from 'sentry/views/replays/detail/accessibility/index';
import Console from 'sentry/views/replays/detail/console';
import DomMutations from 'sentry/views/replays/detail/domMutations';
import DomNodesChart from 'sentry/views/replays/detail/domNodesChart';
import ErrorList from 'sentry/views/replays/detail/errorList/index';
import MemoryChart from 'sentry/views/replays/detail/memoryChart';
import NetworkList from 'sentry/views/replays/detail/network';
import PerfTable from 'sentry/views/replays/detail/perfTable/index';
import Trace from 'sentry/views/replays/detail/trace/index';

type Props = {};

function FocusArea({}: Props) {
  const {getActiveTab} = useActiveReplayTab();

  switch (getActiveTab()) {
    case TabKey.A11Y:
      return <A11y />;
    case TabKey.NETWORK:
      return <NetworkList />;
    case TabKey.TRACE:
      return <Trace />;
    case TabKey.PERF:
      return <PerfTable />;
    case TabKey.ERRORS:
      return <ErrorList />;
    case TabKey.DOM:
      return <DomMutations />;
    case TabKey.MEMORY:
      return (
        <React.Fragment>
          <MemoryChart />
          <DomNodesChart />
        </React.Fragment>
      );
    case TabKey.CONSOLE:
    default: {
      return <Console />;
    }
  }
}

export default FocusArea;
