import {Fragment, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps, useGetPaginationCaption} from 'sentry/utils/pagination';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

import {MonitorTable} from './monitorTable';

const MONITORS_PER_PAGE = 10;

type Props = {
  initialMonitorIds: string[];
  onChange: (monitorIds: string[]) => void;
};

export function ConnectMonitorsDrawer({initialMonitorIds, onChange}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const getPaginationCaption = useGetPaginationCaption();
  // The drawer renders outside the form, so it keeps its own copy of the selection
  const [monitorIds, setMonitorIds] = useState(initialMonitorIds);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const {data, isPending, isError} = useQuery({
    ...detectorListApiOptions(organization, {
      query: query ? `type:metric_issue ${query}` : 'type:metric_issue',
      projects: projectIds.length > 0 ? projectIds.map(Number) : [-1],
      limit: MONITORS_PER_PAGE,
      sortBy: '-latestGroup',
      cursor,
    }),
    select: selectJsonWithHeaders,
  });
  const monitors = data?.json.filter(monitor => monitor.type === 'metric_issue') ?? [];

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
          <Flex gap="md" align="start">
            <CompactSelect
              multiple
              clearable
              search
              options={projects.map(project => ({
                value: project.id,
                label: project.slug,
                leadingItems: <ProjectAvatar project={project} size={16} />,
              }))}
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
              pendingRows={isPending ? MONITORS_PER_PAGE : 0}
              emptyMessage={t('No metric monitors match your search')}
              renderAction={monitor => {
                const isConnected = monitorIds.includes(monitor.id);
                return (
                  <Button
                    size="sm"
                    variant={isConnected ? 'secondary' : 'primary'}
                    aria-label={
                      isConnected
                        ? t('Disconnect %s', monitor.name)
                        : t('Connect %s', monitor.name)
                    }
                    onClick={() => toggleMonitor(monitor.id)}
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
