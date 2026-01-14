import {Fragment, useCallback, useContext, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import FormContext from 'sentry/components/forms/formContext';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Placeholder from 'sentry/components/placeholder';
import {Container as WorkflowEngineContainer} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {getApiQueryData, setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {makeDetectorListQueryKey, useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

const PROJECT_GROUPS = [
  {key: 'member', label: t('My Projects')},
  {key: 'all', label: t('Other')},
];

type MonitorMode = 'project' | 'specific';

interface Props {
  connectedIds: Automation['detectorIds'];
  setConnectedIds: (ids: Automation['detectorIds']) => void;
}

interface ContentProps extends Props {
  initialMode: MonitorMode;
}

function useIssueStreamDetectors() {
  return useDetectorsQuery({
    query: 'type:issue_stream',
    includeIssueStreamDetectors: true,
  });
}

function getInitialMonitorMode(
  issueStreamDetectors: Detector[] | undefined,
  connectedIds: Automation['detectorIds']
): MonitorMode {
  if (!connectedIds.length || !issueStreamDetectors) {
    return 'project';
  }

  return connectedIds.every(id => issueStreamDetectors.find(d => d.id === id))
    ? 'project'
    : 'specific';
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

function AllProjectIssuesSection({
  onProjectChange,
  connectedIds,
}: {
  connectedIds: Automation['detectorIds'];
  onProjectChange: (projectIds: string[]) => void;
}) {
  const issueStreamDetectorsQuery = useIssueStreamDetectors();
  const {projects} = useProjects();
  const {form} = useContext(FormContext);

  // Sync the derived selectedProjectIds to the form model so the field can read from it
  useEffect(() => {
    const selectedProjectIds =
      issueStreamDetectorsQuery.data
        ?.filter(detector => connectedIds.includes(detector.id))
        .map(d => d.projectId) ?? [];
    if (form && selectedProjectIds.length > 0) {
      form.setValue('projectIds', selectedProjectIds);
    }
  }, [connectedIds, form, issueStreamDetectorsQuery.data]);

  return (
    <Stack gap="md">
      <Container maxWidth="400px">
        <SentryProjectSelectorField
          name="projectIds"
          label={t('Projects')}
          placeholder={t('Select projects')}
          projects={projects}
          groupProjects={p => (p.isMember ? 'member' : 'all')}
          groups={PROJECT_GROUPS}
          onChange={(values: string[]) => onProjectChange(values)}
          inline={false}
          flexibleControlStateSize
          stacked
          multiple
          disabled={issueStreamDetectorsQuery.isPending}
        />
      </Container>
      <Alert variant="muted">
        {t(
          '‘All issues’ excludes Metric, Cron, and Uptime. Select specific monitors to alert on these issue types.'
        )}
      </Alert>
    </Stack>
  );
}

function SpecificMonitorsSection({
  connectedIds,
  setConnectedIds,
}: {
  connectedIds: Automation['detectorIds'];
  setConnectedIds: (ids: Automation['detectorIds']) => void;
}) {
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
      <Stack gap="lg">
        <ConnectedMonitorsList
          detectorIds={connectedIds}
          cursor={undefined}
          onCursor={() => {}}
          limit={null}
          openInNewTab
        />
        <Flex gap="md">
          <Button ref={ref} size="sm" icon={<IconEdit />} onClick={toggleDrawer}>
            {t('Edit Monitors')}
          </Button>
          <LinkButton
            size="sm"
            icon={<IconAdd />}
            href={makeMonitorCreatePathname(organization.slug)}
            external
          >
            {t('Create New Monitor')}
          </LinkButton>
        </Flex>
      </Stack>
    );
  }

  return (
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
  );
}

function EditConnectedMonitorsContent({
  initialMode,
  connectedIds,
  setConnectedIds,
}: ContentProps) {
  const [monitorMode, setMonitorMode] = useState<MonitorMode>(initialMode);
  const issueStreamDetectorsQuery = useIssueStreamDetectors();
  const {form} = useContext(FormContext);

  const handleModeChange = useCallback(
    (newMode: MonitorMode) => {
      setMonitorMode(newMode);
      setConnectedIds([]);
      form?.setValue('projectIds', []);
    },
    [form, setConnectedIds]
  );

  const handleProjectChange = useCallback(
    (projectIds: string[]) => {
      setConnectedIds(
        projectIds
          .map(
            projectId =>
              issueStreamDetectorsQuery?.data?.find(d => d.projectId === projectId)?.id
          )
          .filter(defined)
      );
    },
    [issueStreamDetectorsQuery?.data, setConnectedIds]
  );

  return (
    <WorkflowEngineContainer>
      <Section title={t('Source')}>
        <Stack gap="lg">
          <RadioGroup
            label={t('Connected monitors mode')}
            value={monitorMode}
            choices={[
              ['project', t('Alert on all issues in selected projects')],
              ['specific', t('Alert on specific monitors')],
            ]}
            onChange={handleModeChange}
          />
          {monitorMode === 'project' ? (
            <AllProjectIssuesSection
              connectedIds={connectedIds}
              onProjectChange={handleProjectChange}
            />
          ) : (
            <SpecificMonitorsSection
              connectedIds={connectedIds}
              setConnectedIds={setConnectedIds}
            />
          )}
        </Stack>
      </Section>
    </WorkflowEngineContainer>
  );
}

export default function EditConnectedMonitors({connectedIds, setConnectedIds}: Props) {
  const {data: issueStreamDetectors, isPending} = useIssueStreamDetectors();
  const initialMode = getInitialMonitorMode(issueStreamDetectors, connectedIds);

  if (isPending && connectedIds.length > 0) {
    return (
      <WorkflowEngineContainer>
        <Section title={t('Source')}>
          <Placeholder width="100%" height="200px" />
        </Section>
      </WorkflowEngineContainer>
    );
  }

  return (
    <EditConnectedMonitorsContent
      initialMode={initialMode}
      connectedIds={connectedIds}
      setConnectedIds={setConnectedIds}
    />
  );
}

const DrawerContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
`;

const StyledSection = styled(Section)`
  margin-bottom: ${p => p.theme.space.lg};
`;
