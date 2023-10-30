import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import A11y from 'sentry/views/replays/detail/accessibility/index';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import Console from 'sentry/views/replays/detail/console';
import DomNodesChart from 'sentry/views/replays/detail/domNodesChart';
import ErrorList from 'sentry/views/replays/detail/errorList/index';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import MemoryChart from 'sentry/views/replays/detail/memoryChart';
import NetworkList from 'sentry/views/replays/detail/network';
import PerfTable from 'sentry/views/replays/detail/perfTable/index';
import TagPanel from 'sentry/views/replays/detail/tagPanel';
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
    case TabKey.MEMORY:
      return (
        <MemoryTabWrapper>
          <MemoryChart />
          <DomNodesChart />
        </MemoryTabWrapper>
      );
    case TabKey.CONSOLE:
      return <Console />;
    case TabKey.TAGS:
      return <TagPanel />;
    case TabKey.BREADCRUMBS:
    default: {
      return <Breadcrumbs />;
    }
  }
}

const MemoryTabWrapper = styled(FluidHeight)`
  justify-content: center;
  gap: ${space(1)};
  height: 100%;
  display: flex;
`;

export default FocusArea;
