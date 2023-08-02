import {useReplayContext} from 'sentry/components/replays/replayContext';
import useUrlParams from 'sentry/utils/useUrlParams';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import TagPanel from 'sentry/views/replays/detail/tagPanel';

function SidebarArea() {
  const {getParamValue} = useUrlParams('t_side', 'crumbs');
  const {replay} = useReplayContext();

  switch (getParamValue().toLowerCase()) {
    case 'tags':
      return <TagPanel />;
    case 'crumbs':
    default:
      return (
        <Breadcrumbs
          frames={replay?.getChapterFrames()}
          startTimestampMs={replay?.getReplay()?.started_at?.getTime() || 0}
        />
      );
  }
}

export default SidebarArea;
