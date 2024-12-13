import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import Console from 'sentry/views/replays/detail/console';
import ErrorList from 'sentry/views/replays/detail/errorList/index';
import MemoryPanel from 'sentry/views/replays/detail/memoryPanel/index';
import NetworkList from 'sentry/views/replays/detail/network';
import TagPanel from 'sentry/views/replays/detail/tagPanel';
import Trace from 'sentry/views/replays/detail/trace/index';

import type {ReplayRecord} from '../../types';

export default function FocusArea({
  isVideoReplay,
  replayRecord,
}: {
  replayRecord: ReplayRecord | undefined;
  isVideoReplay?: boolean;
}) {
  const {getActiveTab} = useActiveReplayTab({isVideoReplay});

  switch (getActiveTab()) {
    case TabKey.NETWORK:
      return <NetworkList />;
    case TabKey.TRACE:
      return <Trace replayRecord={replayRecord} />;
    case TabKey.ERRORS:
      return <ErrorList />;
    case TabKey.MEMORY:
      return <MemoryPanel />;
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
