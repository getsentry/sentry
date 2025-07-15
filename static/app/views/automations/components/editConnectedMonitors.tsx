import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import Pagination from 'sentry/components/pagination';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {getApiQueryData, setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {makeDetectorListQueryKey, useDetectorsQuery} from 'sentry/views/detectors/hooks';

interface Props {
  connectedIds: Set<string>;
  setConnectedIds: (ids: Set<string>) => void;
}

function SelectedMonitors({
  connectedIds,
  toggleConnected,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  connectedIds: Set<string>;
  toggleConnected?: (params: {detector: Detector}) => void;
}) {
  const {
    data: monitors = [],
    isLoading,
    isError,
  } = useDetectorsQuery(
    {
      ids: Array.from(connectedIds).sort(),
    },
    {
      enabled: connectedIds.size > 0,
    }
  );

  return (
    <Section title={t('Connected Monitors')}>
      <ConnectedMonitorsList
        detectors={monitors}
        connectedDetectorIds={connectedIds}
        isLoading={isLoading}
        isError={isError}
        toggleConnected={toggleConnected}
        numSkeletons={connectedIds.size}
        {...props}
      />
    </Section>
  );
}

function AllMonitors({
  connectedIds,
  toggleConnected,
}: {
  connectedIds: Set<string>;
  toggleConnected: (params: {detector: Detector}) => void;
}) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const {
    data: monitors = [],
    isLoading,
    isError,
    getResponseHeader,
  } = useDetectorsQuery({
    query,
    cursor,
    limit: 10,
  });
  return (
    <Section title={t('All Monitors')}>
      <DetectorSearch initialQuery={query} onSearch={setQuery} />
      <ConnectedMonitorsList
        data-test-id="drawer-all-monitors-list"
        detectors={monitors}
        connectedDetectorIds={connectedIds}
        isLoading={isLoading}
        isError={isError}
        toggleConnected={toggleConnected}
        emptyMessage={t('No monitors found')}
        numSkeletons={10}
      />
      <Pagination onCursor={setCursor} pageLinks={getResponseHeader?.('Link')} />
    </Section>
  );
}

function ConnectMonitorsDrawer({
  initialIds,
  saveConnectedIds,
}: {
  initialIds: Set<string>;
  saveConnectedIds: (ids: Set<string>) => void;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  // Because GlobalDrawer is rendered outside of our form context, we need to duplicate the state here
  const [connectedIds, setConnectedIds] = useState<Set<string>>(initialIds);

  const toggleConnected = ({detector}: {detector: Detector}) => {
    const sortedIds = Array.from(connectedIds).sort();

    const oldDetectorsData =
      getApiQueryData<Detector[]>(
        queryClient,
        makeDetectorListQueryKey({
          orgSlug: organization.slug,
          ids: sortedIds,
        })
      ) ?? [];

    const newDetectors = (
      oldDetectorsData.some(d => d.id === detector.id)
        ? oldDetectorsData.filter(d => d.id !== detector.id)
        : [...oldDetectorsData, detector]
    )
      // API will return ID ascending, so this avoids re-ordering
      .sort((a, b) => a.id.localeCompare(b.id));
    const newDetectorIds = newDetectors.map(d => d.id);

    // Update the query cache to prevent the list from being fetched anew
    setApiQueryData<Detector[]>(
      queryClient,
      makeDetectorListQueryKey({
        orgSlug: organization.slug,
        ids: newDetectorIds,
      }),
      newDetectors
    );

    setConnectedIds(new Set(newDetectorIds));
    saveConnectedIds(new Set(newDetectorIds));
  };

  return (
    <Fragment>
      <DrawerHeader hideBar />
      <DrawerContent>
        {connectedIds.size > 0 && (
          <SelectedMonitors
            data-test-id="drawer-connected-monitors-list"
            connectedIds={connectedIds}
            toggleConnected={toggleConnected}
          />
        )}
        <AllMonitors connectedIds={connectedIds} toggleConnected={toggleConnected} />
      </DrawerContent>
    </Fragment>
  );
}

export default function EditConnectedMonitors({connectedIds, setConnectedIds}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer(
      () => (
        <ConnectMonitorsDrawer
          initialIds={connectedIds}
          saveConnectedIds={setConnectedIds}
        />
      ),
      {
        ariaLabel: t('Connect Monitors'),
        shouldCloseOnInteractOutside: el => {
          if (!ref.current) {
            return true;
          }
          return !ref.current.contains(el);
        },
      }
    );
  };

  if (connectedIds.size > 0) {
    return (
      <Container>
        <SelectedMonitors connectedIds={connectedIds} />
        <ButtonWrapper justify="space-between">
          <Button size="sm" icon={<IconAdd />} onClick={toggleDrawer}>
            {t('Create New Monitor')}
          </Button>
          <Button size="sm" icon={<IconEdit />} onClick={toggleDrawer}>
            {t('Edit Monitors')}
          </Button>
        </ButtonWrapper>
      </Container>
    );
  }

  return (
    <Container>
      <Section title={t('Connected Monitors')}>
        <Button
          ref={ref}
          size="sm"
          style={{width: 'min-content'}}
          priority="primary"
          icon={<IconAdd />}
          onClick={toggleDrawer}
        >
          {t('Connect Monitors')}
        </Button>
      </Section>
    </Container>
  );
}

const DrawerContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
`;

const ButtonWrapper = styled(Flex)`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${p => p.theme.space.xl};
  margin: -${p => p.theme.space.xl};
`;
