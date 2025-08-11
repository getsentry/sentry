import {createContext, useCallback, useContext} from 'react';
import type {eventWithTime, ReplayPlugin} from '@sentry-internal/rrweb';

import {CanvasReplayerPlugin} from 'sentry/components/replays/canvasReplayerPlugin';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

const Context = createContext<(events: eventWithTime[]) => ReplayPlugin[]>(() => []);

export function ReplayPlayerPluginsContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const organization = useOrganization();

  const getter = useCallback(
    (events: eventWithTime[]) => {
      return getPlugins(organization, events);
    },
    [organization]
  );

  return <Context value={getter}>{children}</Context>;
}

export function useReplayPlayerPlugins() {
  return useContext(Context);
}

function getPlugins(_organization: Organization, events: eventWithTime[]) {
  return [CanvasReplayerPlugin(events)];
}
