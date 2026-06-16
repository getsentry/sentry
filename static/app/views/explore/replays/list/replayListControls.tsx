import {Flex} from '@sentry/scraps/layout';

import {ReplaysFilters} from 'sentry/views/explore/replays/list/filters';
import {ReplayIndexTimestampPrefPicker} from 'sentry/views/explore/replays/list/replayIndexTimestampPrefPicker';
import {ReplayWidgetsToggleButton} from 'sentry/views/explore/replays/list/replayWidgetsToggleButton';
import {SaveReplayQueryButton} from 'sentry/views/explore/replays/list/saveReplayQueryButton';
import {ReplaysSearch} from 'sentry/views/explore/replays/list/search';

interface Props {
  onToggleWidgets: () => void;
  showDeadRageClickCards: boolean;
  widgetIsOpen: boolean;
}

export function ReplayListControls({
  onToggleWidgets,
  showDeadRageClickCards,
  widgetIsOpen,
}: Props) {
  return (
    <Flex gap="md" wrap="wrap">
      <ReplaysFilters />
      <ReplaysSearch />
      <ReplayIndexTimestampPrefPicker />
      {showDeadRageClickCards ? (
        <ReplayWidgetsToggleButton
          onClick={onToggleWidgets}
          widgetIsOpen={widgetIsOpen}
        />
      ) : null}
      <SaveReplayQueryButton />
    </Flex>
  );
}
