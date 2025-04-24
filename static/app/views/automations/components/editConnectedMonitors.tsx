import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';

export default function EditConnectedMonitors() {
  const {monitors, connectedMonitorIds, toggleConnected} = useConnectedMonitors();

  const connectedMonitors = monitors.filter(monitor =>
    connectedMonitorIds.has(monitor.id)
  );
  const unconnectedMonitors = monitors.filter(
    monitor => !connectedMonitorIds.has(monitor.id)
  );

  return (
    <div>
      {connectedMonitors.length > 0 && (
        <Fragment>
          <Heading>{t('Connected Monitors')}</Heading>
          <ConnectedMonitorsList
            monitors={connectedMonitors}
            connectedMonitorIds={connectedMonitorIds}
            toggleConnected={toggleConnected}
          />
        </Fragment>
      )}
      <Heading>
        {connectedMonitors.length > 0 ? t('Other Monitors') : t('All Monitors')}
      </Heading>
      <div style={{flexGrow: 1}}>
        <StyledSearchBar placeholder={t('Search for a monitor or project')} />
      </div>
      <ConnectedMonitorsList
        monitors={unconnectedMonitors}
        connectedMonitorIds={connectedMonitorIds}
        toggleConnected={toggleConnected}
      />
    </div>
  );
}

export function useConnectedMonitors() {
  // TODO: Fetch monitors from API
  const monitors: Detector[] = [];

  const [connectedMonitorIds, setConnectedMonitorIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('connectedMonitorIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const toggleConnected = (id: string) => {
    setConnectedMonitorIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      localStorage.setItem('connectedMonitorIds', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  return {monitors, connectedMonitorIds, toggleConnected};
}

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1.5)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-bottom: ${space(2)};
`;
