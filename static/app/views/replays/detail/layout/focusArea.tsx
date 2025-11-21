import AnalyticsArea from 'sentry/components/analyticsArea';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import Ai from 'sentry/views/replays/detail/ai/ai';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import Console from 'sentry/views/replays/detail/console';
import ErrorList from 'sentry/views/replays/detail/errorList/index';
import MemoryPanel from 'sentry/views/replays/detail/memoryPanel/index';
import NetworkList from 'sentry/views/replays/detail/network';
import OurLogs from 'sentry/views/replays/detail/ourlogs';
import Playlist from 'sentry/views/replays/detail/playlist';
import TagPanel from 'sentry/views/replays/detail/tagPanel';
import TraceFeature from 'sentry/views/replays/detail/trace/index';

export default function FocusArea({isVideoReplay}: {isVideoReplay?: boolean}) {
  const {getActiveTab} = useActiveReplayTab({isVideoReplay});

  switch (getActiveTab()) {
    case TabKey.AI:
      return (
        <AnalyticsArea name="ai_summary_tab">
          <Ai />
        </AnalyticsArea>
      );
    case TabKey.NETWORK:
      return (
        <AnalyticsArea name="network_tab">
          <NetworkList />
        </AnalyticsArea>
      );
    case TabKey.TRACE:
      return (
        <AnalyticsArea name="trace_tab">
          <TraceFeature />
        </AnalyticsArea>
      );
    case TabKey.ERRORS:
      return (
        <AnalyticsArea name="errors_tab">
          <ErrorList />
        </AnalyticsArea>
      );
    case TabKey.MEMORY:
      return (
        <AnalyticsArea name="memory_tab">
          <MemoryPanel />
        </AnalyticsArea>
      );
    case TabKey.CONSOLE:
      return (
        <AnalyticsArea name="console_tab">
          <Console />
        </AnalyticsArea>
      );
    case TabKey.LOGS:
      return (
        <AnalyticsArea name="logs_tab">
          <OurLogs />
        </AnalyticsArea>
      );
    case TabKey.TAGS:
      return (
        <AnalyticsArea name="tags_tab">
          <TagPanel />
        </AnalyticsArea>
      );
    case TabKey.PLAYLIST:
      return (
        <AnalyticsArea name="playlist_tab">
          <Playlist />
        </AnalyticsArea>
      );
    case TabKey.BREADCRUMBS:
    default: {
      return (
        <AnalyticsArea name="breadcrumbs_tab">
          <Breadcrumbs />
        </AnalyticsArea>
      );
    }
  }
}
