import {Fragment, useState} from 'react';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t, tn} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {ConnectedMonitorsList} from 'sentry/views/automations/components/connectedMonitorsList';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';

type Props = {initialMonitorIds: string[]; onChange: (monitorIds: string[]) => void};

export function ConnectMonitorsDrawer({initialMonitorIds, onChange}: Props) {
  // The drawer renders outside the form, so it keeps its own copy of the selection
  const [monitorIds, setMonitorIds] = useState(initialMonitorIds);

  const toggleMonitor = ({detector}: {detector: Detector}) => {
    const next = monitorIds.includes(detector.id)
      ? monitorIds.filter(id => id !== detector.id)
      : [...monitorIds, detector.id];
    setMonitorIds(next);
    onChange(next);
  };

  return (
    <Fragment>
      <DrawerHeader>{t('Connect monitors')}</DrawerHeader>
      <DrawerBody>
        <Stack gap="lg">
          <Text variant="muted">
            {t('Pick the metric monitors this automation investigates when they breach.')}
          </Text>
          <PageFiltersContainer>
            <MetricMonitors connectedIds={monitorIds} toggleConnected={toggleMonitor} />
          </PageFiltersContainer>
          <Text size="sm" variant="muted">
            {tn('%s monitor connected', '%s monitors connected', monitorIds.length)}
            {' · '}
            {t('Save the automation to apply your changes.')}
          </Text>
        </Stack>
      </DrawerBody>
    </Fragment>
  );
}

function MetricMonitors({
  connectedIds,
  toggleConnected,
}: {
  connectedIds: string[];
  toggleConnected: (params: {detector: Detector}) => void;
}) {
  const {selection} = usePageFilters();
  const [query, setQuery] = useState('');

  return (
    <Stack gap="lg">
      <Flex gap="md" align="start">
        <ProjectPageFilter storageNamespace="seerAutomationDrawer" />
        <Container flexGrow={1} minWidth={0}>
          <DetectorSearch
            initialQuery={query}
            excludeKeys={['type']}
            onSearch={setQuery}
          />
        </Container>
      </Flex>
      {/* Keyed so pagination restarts when the filters change */}
      <MonitorList
        key={`${selection.projects.join(',')}|${query}`}
        connectedIds={connectedIds}
        toggleConnected={toggleConnected}
        projectIds={selection.projects}
        query={query}
      />
    </Stack>
  );
}

function MonitorList({
  connectedIds,
  toggleConnected,
  projectIds,
  query,
}: {
  connectedIds: string[];
  projectIds: number[];
  query: string;
  toggleConnected: (params: {detector: Detector}) => void;
}) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  return (
    <ConnectedMonitorsList
      connectedDetectorIds={new Set(connectedIds)}
      toggleConnected={toggleConnected}
      emptyMessage={t('No metric monitors match your search')}
      cursor={cursor}
      onCursor={setCursor}
      query={new MutableSearch(['type:metric_issue', query]).formatString()}
      projectIds={projectIds}
      openInNewTab
    />
  );
}
