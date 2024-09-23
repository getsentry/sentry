import {createContext, useCallback, useContext} from 'react';
import type {eventWithTime, ReplayPlugin} from '@sentry-internal/rrweb';

import {CanvasReplayerPlugin} from 'sentry/components/replays/canvasReplayerPlugin';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

const context = createContext<(events: eventWithTime[]) => ReplayPlugin[]>(() => []);

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

  return <context.Provider value={getter}>{children}</context.Provider>;
}

export function useReplayPlayerPlugins() {
  return useContext(context);
}

function getPlugins(organization: Organization, events: eventWithTime[]) {
  return organization.features.includes('session-replay-enable-canvas-replayer')
    ? [CanvasReplayerPlugin(events)]
    : [];
}
