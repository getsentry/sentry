import {useReplayContext} from 'sentry/components/replays/replayContext';
import useUrlParams from 'sentry/utils/useUrlParams';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import TagPanel from 'sentry/views/replays/detail/tagPanel';

const SidebarArea = () => {
  const {getParamValue} = useUrlParams('t_side', 'crumbs');
  const {replay} = useReplayContext();

  switch (getParamValue()) {
    case 'tags':
      return <TagPanel />;
    case 'crumbs':
    default:
      return (
        <Breadcrumbs
          breadcrumbs={replay?.getRawCrumbs()}
          startTimestampMs={replay?.getReplay()?.started_at?.getTime() || 0}
        />
      );
  }
};

export default SidebarArea;
