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
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {getApiQueryData, setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {makeDetectorListQueryKey, useDetectorsQuery} from 'sentry/views/detectors/hooks';

interface Props {
  connectedIds: Automation['detectorIds'];
  setConnectedIds: (ids: Automation['detectorIds']) => void;
}

function SelectedMonitors({
  connectedIds,
  toggleConnected,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  connectedIds: Automation['detectorIds'];
  toggleConnected?: (params: {detector: Detector}) => void;
}) {
  const {
    data: monitors = [],
    isLoading,
    isError,
  } = useDetectorsQuery({ids: connectedIds}, {enabled: connectedIds.length > 0});

  return (
    <Section title={t('Connected Monitors')}>
      <ConnectedMonitorsList
        detectors={monitors}
        connectedDetectorIds={connectedIds}
        isLoading={isLoading}
        isError={isError}
        toggleConnected={toggleConnected}
        numSkeletons={connectedIds.length}
        {...props}
      />
    </Section>
  );
}

function AllMonitors({
  connectedIds,
  toggleConnected,
  footerContent,
}: {
  connectedIds: Automation['detectorIds'];
  toggleConnected: (params: {detector: Detector}) => void;
  footerContent?: React.ReactNode;
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
      <Flex justify="space-between">
        <div>{footerContent}</div>
        <PaginationWithoutMargin
          onCursor={setCursor}
          pageLinks={getResponseHeader?.('Link')}
        />
      </Flex>
    </Section>
  );
}

export function ConnectMonitorsContent({
  initialIds,
  saveConnectedIds,
  footerContent,
}: {
  initialIds: Automation['detectorIds'];
  saveConnectedIds: (ids: Automation['detectorIds']) => void;
  footerContent?: React.ReactNode;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  // Because GlobalDrawer is rendered outside of our form context, we need to duplicate the state here
  const [connectedIds, setConnectedIds] = useState<Automation['detectorIds']>(
    initialIds.toSorted()
  );

  const toggleConnected = ({detector}: {detector: Detector}) => {
    const oldDetectorsData =
      getApiQueryData<Detector[]>(
        queryClient,
        makeDetectorListQueryKey({
          orgSlug: organization.slug,
          ids: connectedIds,
        })
      ) ?? [];

    const newDetectors = (
      oldDetectorsData.some(d => d.id === detector.id)
        ? oldDetectorsData.filter(d => d.id !== detector.id)
        : [...oldDetectorsData, detector]
    )
      // API will return ID ascending, so this avoids re-ordering
      .toSorted((a, b) => Number(a.id) - Number(b.id));
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

    setConnectedIds(newDetectorIds);
    saveConnectedIds(newDetectorIds);
  };

  return (
    <Fragment>
      {connectedIds.length > 0 && (
        <SelectedMonitors
          data-test-id="drawer-connected-monitors-list"
          connectedIds={connectedIds}
          toggleConnected={toggleConnected}
        />
      )}
      <AllMonitors
        connectedIds={connectedIds}
        toggleConnected={toggleConnected}
        footerContent={footerContent}
      />
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
        <Fragment>
          <DrawerHeader hideBar />
          <DrawerContent>
            <ConnectMonitorsContent
              initialIds={connectedIds}
              saveConnectedIds={setConnectedIds}
            />
          </DrawerContent>
        </Fragment>
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

  if (connectedIds.length > 0) {
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

const PaginationWithoutMargin = styled(Pagination)`
  margin: ${p => p.theme.space.none};
`;
