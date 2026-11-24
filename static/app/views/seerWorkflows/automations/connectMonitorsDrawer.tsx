import {Fragment, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import type {SortDirection} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps, useGetPaginationCaption} from 'sentry/utils/pagination';
import {useCompactSelectProjectOptions} from 'sentry/utils/project/useCompactSelectProjectOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {canConnectAutomationToDetector} from 'sentry/views/automations/utils/permissions';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

import {MonitorTable} from './monitorTable';

const MONITORS_PER_PAGE = 10;

type Props = {initialMonitorIds: string[]; onChange: (monitorIds: string[]) => void};

export function ConnectMonitorsDrawer({initialMonitorIds, onChange}: Props) {
  // The drawer renders outside the form, so it keeps its own copy of the selection
  const [monitorIds, setMonitorIds] = useState(initialMonitorIds);

  const toggleMonitor = (monitorId: string) => {
    const next = monitorIds.includes(monitorId)
      ? monitorIds.filter(id => id !== monitorId)
      : [...monitorIds, monitorId];
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
          <MetricMonitors connectedIds={monitorIds} toggleConnected={toggleMonitor} />
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
  toggleConnected: (monitorId: string) => void;
}) {
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [lastBreachSort, setLastBreachSort] = useState<SortDirection>('desc');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const organization = useOrganization();
  const {projects} = useProjects();
  const getPaginationCaption = useGetPaginationCaption();
  const projectOptions = useCompactSelectProjectOptions({projects});

  const {data, isPending, isError} = useQuery({
    ...detectorListApiOptions(organization, {
      type: 'metric_issue',
      query,
      projects: projectIds.length > 0 ? projectIds.map(Number) : [-1],
      limit: MONITORS_PER_PAGE,
      sortBy: lastBreachSort === 'desc' ? '-latestGroup' : 'latestGroup',
      cursor,
    }),
    select: selectJsonWithHeaders,
  });
  const monitors = data?.json ?? [];

  return (
    <Stack gap="lg">
      <Flex gap="md" align="start">
        <CompactSelect
          multiple
          clearable
          search
          menuWidth="22em"
          options={projectOptions}
          value={projectIds}
          onChange={selected => {
            setProjectIds(selected.map(option => option.value));
            setCursor(undefined);
          }}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Project')}>
              {projectIds.length === 0 ? t('All') : triggerProps.children}
            </OverlayTrigger.Button>
          )}
        />
        <Container flexGrow={1} minWidth={0}>
          <DetectorSearch
            initialQuery={query}
            excludeKeys={['type']}
            onSearch={nextQuery => {
              setQuery(nextQuery);
              setCursor(undefined);
            }}
          />
        </Container>
      </Flex>
      <Container containerType="inline-size">
        <MonitorTable
          monitors={monitors}
          isError={isError}
          lastBreachSort={{
            direction: lastBreachSort,
            onSort: () => {
              setLastBreachSort(lastBreachSort === 'desc' ? 'asc' : 'desc');
              setCursor(undefined);
            },
          }}
          pendingRows={isPending ? MONITORS_PER_PAGE : 0}
          emptyMessage={t('No metric monitors match your search')}
          renderAction={monitor => {
            const isConnected = connectedIds.includes(monitor.id);
            const canConnect = canConnectAutomationToDetector({
              organization,
              detector: monitor,
              project: projects.find(project => project.id === monitor.projectId),
            });
            return (
              <Button
                size="sm"
                variant={isConnected ? 'secondary' : 'primary'}
                aria-label={
                  isConnected
                    ? t('Disconnect %s', monitor.name)
                    : t('Connect %s', monitor.name)
                }
                disabled={!canConnect}
                tooltipProps={{
                  title: canConnect
                    ? undefined
                    : t(
                        "You don't have permission to change this monitor's alert connections."
                      ),
                }}
                onClick={() => toggleConnected(monitor.id)}
              >
                {isConnected ? t('Disconnect') : t('Connect')}
              </Button>
            );
          }}
        />
        <Pagination
          onCursor={setCursor}
          {...getPaginationProps(data?.headers.Link)}
          caption={
            data
              ? getPaginationCaption({
                  cursor,
                  limit: MONITORS_PER_PAGE,
                  pageLength: monitors.length,
                  total: data.headers['X-Hits'] ?? 0,
                })
              : undefined
          }
        />
      </Container>
    </Stack>
  );
}
