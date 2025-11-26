import {Fragment, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {getApiQueryData, setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {makeDetectorListQueryKey} from 'sentry/views/detectors/hooks';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

interface Props {
  connectedIds: Automation['detectorIds'];
  setConnectedIds: (ids: Automation['detectorIds']) => void;
}

function ConnectedMonitors({
  connectedIds,
  toggleConnected,
}: {
  connectedIds: Automation['detectorIds'];
  toggleConnected?: (params: {detector: Detector}) => void;
}) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  return (
    <StyledSection title={t('Connected Monitors')}>
      <ConnectedMonitorsList
        data-test-id="drawer-connected-monitors-list"
        detectorIds={connectedIds}
        connectedDetectorIds={new Set(connectedIds)}
        toggleConnected={toggleConnected}
        cursor={cursor}
        onCursor={setCursor}
        limit={null}
        openInNewTab
      />
    </StyledSection>
  );
}

function AllMonitors({
  connectedIds,
  toggleConnected,
}: {
  connectedIds: Automation['detectorIds'];
  toggleConnected: (params: {detector: Detector}) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const onSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCursor(undefined);
  }, []);
  const {selection} = usePageFilters();

  return (
    <PageFiltersContainer>
      <Section title={t('All Monitors')}>
        <Flex gap="xl">
          <ProjectPageFilter storageNamespace="automationDrawer" />
          <div style={{flexGrow: 1}}>
            <DetectorSearch initialQuery={searchQuery} onSearch={onSearch} />
          </div>
        </Flex>
        <ConnectedMonitorsList
          data-test-id="drawer-all-monitors-list"
          detectorIds={null}
          connectedDetectorIds={new Set(connectedIds)}
          toggleConnected={toggleConnected}
          emptyMessage={t('No monitors found')}
          cursor={cursor}
          onCursor={setCursor}
          query={searchQuery}
          projectIds={selection.projects}
          openInNewTab
        />
      </Section>
    </PageFiltersContainer>
  );
}

function ConnectMonitorsDrawer({
  initialIds,
  setDetectorIds,
}: {
  initialIds: string[];
  setDetectorIds: (ids: Automation['detectorIds']) => void;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  // Because GlobalDrawer is rendered outside of our form context, we need to duplicate the state here
  const [localDetectorIds, setLocalDetectorIds] = useState(initialIds);

  const toggleConnected = ({detector}: {detector: Detector}) => {
    const oldDetectorsData =
      getApiQueryData<Detector[]>(
        queryClient,
        makeDetectorListQueryKey({
          orgSlug: organization.slug,
          ids: localDetectorIds,
          includeIssueStreamDetectors: true,
        })
      ) ?? [];

    const newDetectors = (
      oldDetectorsData.some(d => d.id === detector.id)
        ? oldDetectorsData.filter(d => d.id !== detector.id)
        : [...oldDetectorsData, detector]
    ).sort((a, b) => a.id.localeCompare(b.id)); // API will return ID ascending, so this avoids re-ordering
    const newDetectorIds = newDetectors.map(d => d.id);

    // Update the query cache to prevent the list from being fetched anew
    setApiQueryData<Detector[]>(
      queryClient,
      makeDetectorListQueryKey({
        orgSlug: organization.slug,
        ids: newDetectorIds,
        includeIssueStreamDetectors: true,
      }),
      newDetectors
    );

    setLocalDetectorIds(newDetectorIds);
    setDetectorIds(newDetectorIds);
  };

  return (
    <Fragment>
      <DrawerHeader hideBar />
      <DrawerContent>
        <ConnectedMonitors
          connectedIds={localDetectorIds}
          toggleConnected={toggleConnected}
        />
        <AllMonitors connectedIds={localDetectorIds} toggleConnected={toggleConnected} />
      </DrawerContent>
    </Fragment>
  );
}

export default function EditConnectedMonitors({connectedIds, setConnectedIds}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();
  const organization = useOrganization();

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer(
      () => (
        <ConnectMonitorsDrawer
          initialIds={connectedIds}
          setDetectorIds={setConnectedIds}
        />
      ),
      {
        ariaLabel: t('Connect Monitors'),
        shouldCloseOnLocationChange: nextLocation =>
          nextLocation.pathname !== window.location.pathname,
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
        <Section title={t('Connected Monitors')}>
          <ConnectedMonitorsList
            detectorIds={connectedIds}
            cursor={undefined}
            onCursor={() => {}}
            limit={null}
            openInNewTab
          />
        </Section>
        <ButtonWrapper justify="between">
          <LinkButton
            size="sm"
            icon={<IconAdd />}
            href={makeMonitorCreatePathname(organization.slug)}
            external
          >
            {t('Create New Monitor')}
          </LinkButton>
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
  padding: ${p => p.theme.space.lg};
  margin: -${p => p.theme.space.lg};
`;

const StyledSection = styled(Section)`
  margin-bottom: ${p => p.theme.space.lg};
`;
