import {useEffect, useRef} from 'react';

import {useDrawer} from '@sentry/scraps/drawer';

import {t} from 'sentry/locale';
import type {SessionSelection} from 'sentry/views/explore/usersessions/sessionDetail/useSelectedItem';
import type {
  SessionEvent,
  SessionRange,
} from 'sentry/views/explore/usersessions/sessionDetail/useSessionDetail';

import {SessionItemDetailPanel} from './panel';

const DRAWER_KEY = 'session-telemetry-detail';

/**
 * Wider than the drawer's own default, because the widest thing it holds is a
 * trace waterfall. Only the first open uses it — after that the width the user
 * dragged it to is what persists, under `DRAWER_KEY`.
 */
const DRAWER_WIDTH = '50vw';

interface Options {
  bounds: SessionRange | undefined;
  dateParams: Record<string, any>;
  isPending: boolean;
  selectedEvent: SessionEvent | undefined;
  selection: SessionSelection;
}

/**
 * Keeps the details drawer in step with the selected item.
 *
 * `passive` mode rather than the default is the point of this hook. The drawer
 * sits beside a timeline that is still meant to be used; blocking mode would lock
 * the page's scroll and dismiss itself the moment the user reached back to the
 * scrubber or the next rail row. Escape and the close button still close it.
 *
 * Re-opening on every selection change is deliberate and cheap. `GlobalDrawer`
 * renders its panel under a constant key, so overwriting the config swaps the
 * content in place rather than replaying the slide-in — which is also why the
 * renderer can be a fresh closure over the current selection instead of reading
 * through a ref.
 */
export function useSessionItemDrawer({
  selection,
  selectedEvent,
  bounds,
  dateParams,
  isPending,
}: Options) {
  const {openDrawer, closeDrawer} = useDrawer();
  const {selectedKey, clearSelection, pathname} = selection;

  // Whether *this* page put the drawer up, so clearing a selection can't tear
  // down somebody else's drawer. Only ever touched from inside the effect.
  const isOursRef = useRef(false);

  useEffect(() => {
    if (selectedKey === null) {
      if (isOursRef.current) {
        isOursRef.current = false;
        closeDrawer();
      }
      return;
    }

    isOursRef.current = true;
    openDrawer(
      () => (
        <SessionItemDetailPanel
          event={selectedEvent}
          bounds={bounds}
          dateParams={dateParams}
          isPending={isPending}
        />
      ),
      {
        ariaLabel: t('Telemetry details'),
        // Persists the width the user dragged it to.
        drawerKey: DRAWER_KEY,
        drawerWidth: DRAWER_WIDTH,
        mode: 'passive',
        // The timeline writes its filters and its sort to the URL as the user
        // works, so the drawer can't close on any navigation that keeps a
        // selection. Leaving the page is a different matter: the panel belongs to
        // this timeline, and following one of its own links out — to the waterfall,
        // to an issue — should take the panel with it. Closing this way
        // deliberately skips `onClose`: the URL has already moved on, and writing
        // to the one we just left would navigate back to it.
        shouldCloseOnLocationChange: nextLocation =>
          nextLocation.pathname !== pathname || !nextLocation.query.item,
        onClose: clearSelection,
      }
    );
  }, [
    selectedKey,
    selectedEvent,
    bounds,
    dateParams,
    isPending,
    pathname,
    clearSelection,
    openDrawer,
    closeDrawer,
  ]);
}
