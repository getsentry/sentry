import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Pagination from 'sentry/components/pagination';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {getApiQueryData, setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {makeDetectorListQueryKey, useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

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
    <StyledSection title={t('Connected Monitors')}>
      <ConnectedMonitorsList
        detectors={monitors}
        connectedDetectorIds={connectedIds}
        isLoading={isLoading}
        isError={isError}
        toggleConnected={toggleConnected}
        numSkeletons={connectedIds.length}
        openInNewTab
        {...props}
      />
    </StyledSection>
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
  const {selection, isReady} = usePageFilters();
  const {
    data: monitors = [],
    isLoading,
    isError,
    getResponseHeader,
  } = useDetectorsQuery(
    {
      query,
      cursor,
      limit: 10,
      projects: selection.projects,
    },
    {enabled: isReady}
  );

  return (
    <PageFiltersContainer>
      <Section title={t('All Monitors')}>
        <Flex gap="xl">
          <ProjectPageFilter storageNamespace="automationDrawer" />
          <div style={{flexGrow: 1}}>
            <DetectorSearch initialQuery={query} onSearch={setQuery} />
          </div>
        </Flex>
        <ConnectedMonitorsList
          data-test-id="drawer-all-monitors-list"
          detectors={monitors}
          connectedDetectorIds={connectedIds}
          isLoading={isLoading}
          isError={isError}
          toggleConnected={toggleConnected}
          emptyMessage={t('No monitors found')}
          numSkeletons={10}
          openInNewTab
        />
        <Flex justify="between">
          <div>{footerContent}</div>
          <PaginationWithoutMargin
            onCursor={setCursor}
            pageLinks={getResponseHeader?.('Link')}
          />
        </Flex>
      </Section>
    </PageFiltersContainer>
  );
}

function ConnectMonitorsContent({
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
    const newDetectorIds = (
      connectedIds.includes(detector.id)
        ? connectedIds.filter(id => id !== detector.id)
        : [...connectedIds, detector.id]
    )
      // Sort by ID to match the API response order
      .toSorted((a, b) => Number(a) - Number(b));

    setConnectedIds(newDetectorIds);
    saveConnectedIds(newDetectorIds);

    const cachedConnectedDetectors =
      getApiQueryData<Detector[]>(
        queryClient,
        makeDetectorListQueryKey({
          orgSlug: organization.slug,
          ids: connectedIds,
        })
      ) ?? [];
    const connectedDetectorsData = newDetectorIds
      .map(id => {
        if (id === detector.id) {
          return detector;
        }
        return cachedConnectedDetectors.find(d => d.id === id);
      })
      .filter(defined);

    // If for some reason the cached data doesn't match the full list of connected detectors,
    // don't optimistically update the cache. React query will show a loading state in this case.
    if (connectedDetectorsData.length !== newDetectorIds.length) {
      return;
    }

    // If we do have the correct data already, optimistically update the cache to avoid a loading state.
    setApiQueryData<Detector[]>(
      queryClient,
      makeDetectorListQueryKey({
        orgSlug: organization.slug,
        ids: newDetectorIds,
      }),
      connectedDetectorsData
    );
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
  const organization = useOrganization();
  const {monitorsLinkPrefix} = useMonitorViewContext();

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
        <SelectedMonitors connectedIds={connectedIds} />
        <ButtonWrapper justify="between">
          <LinkButton
            size="sm"
            icon={<IconAdd />}
            href={makeMonitorCreatePathname(organization.slug, monitorsLinkPrefix)}
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

const PaginationWithoutMargin = styled(Pagination)`
  margin: ${p => p.theme.space['0']};
`;

const StyledSection = styled(Section)`
  margin-bottom: ${p => p.theme.space.lg};
`;
