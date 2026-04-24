import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {ReplaysFilters} from 'sentry/views/explore/replays/list/filters';
import {ReplayIndexTimestampPrefPicker} from 'sentry/views/explore/replays/list/replayIndexTimestampPrefPicker';
import {ReplayWidgetsToggleButton} from 'sentry/views/explore/replays/list/replayWidgetsToggleButton';
import {SaveReplayQueryButton} from 'sentry/views/explore/replays/list/saveReplayQueryButton';
import {ReplaysSearch} from 'sentry/views/explore/replays/list/search';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

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
  const hasPageFrameFeature = useHasPageFrameFeature();

  return (
    <Flex gap="md" wrap="wrap">
      <ReplaysFilters />
      <ReplaysSearch />
      {hasPageFrameFeature ? (
        <Fragment>
          <ReplayIndexTimestampPrefPicker />
          {showDeadRageClickCards ? (
            <ReplayWidgetsToggleButton
              onClick={onToggleWidgets}
              widgetIsOpen={widgetIsOpen}
            />
          ) : null}
          <SaveReplayQueryButton />
        </Fragment>
      ) : (
        <Fragment>
          <SaveReplayQueryButton />
          {showDeadRageClickCards ? (
            <ReplayWidgetsToggleButton
              onClick={onToggleWidgets}
              widgetIsOpen={widgetIsOpen}
            />
          ) : null}
        </Fragment>
      )}
    </Flex>
  );
}
