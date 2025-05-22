import type {Dispatch, SetStateAction} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

interface Props {
  connectedIds: Set<string>;
  setConnectedIds: Dispatch<SetStateAction<Set<string>>>;
}

export default function EditConnectedMonitors({connectedIds, setConnectedIds}: Props) {
  const {data: monitors = []} = useDetectorsQuery();

  const connectedMonitors = monitors.filter(monitor => connectedIds.has(monitor.id));
  const unconnectedMonitors = monitors.filter(monitor => !connectedIds.has(monitor.id));

  return (
    <div>
      {connectedMonitors.length > 0 && (
        <Fragment>
          <Heading>{t('Connected Monitors')}</Heading>
          <ConnectedMonitorsList
            monitors={connectedMonitors}
            connectedIds={connectedIds}
            setConnectedIds={setConnectedIds}
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
        connectedIds={connectedIds}
        setConnectedIds={setConnectedIds}
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
