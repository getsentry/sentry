import {Fragment} from 'react';
import styled from '@emotion/styled';

import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {useConnectedIds} from 'sentry/views/automations/hooks/utils';

export default function EditConnectedMonitors() {
  const monitors: Detector[] = []; // TODO: Fetch monitors from API
  const {connectedIds, toggleConnected} = useConnectedIds();

  const connectedMonitors = monitors.filter(monitor => connectedIds.has(monitor.id));
  const unconnectedMonitors = monitors.filter(monitor => !connectedIds.has(monitor.id));

  return (
    <div>
      {connectedMonitors.length > 0 && (
        <Fragment>
          <Heading>{t('Connected Monitors')}</Heading>
          <ConnectedMonitorsList
            monitors={connectedMonitors}
            connectedMonitorIds={connectedIds}
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
        connectedMonitorIds={connectedIds}
        toggleConnected={toggleConnected}
      />
    </div>
  );
}

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1.5)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
  margin-bottom: ${space(2)};
`;
