import {Fragment, useCallback, useContext, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {RadioGroup, type RadioOption} from 'sentry/components/forms/controls/radioGroup';
import {SentryProjectSelectorField} from 'sentry/components/forms/fields/sentryProjectSelectorField';
import {FormContext} from 'sentry/components/forms/formContext';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {Container as WorkflowEngineContainer} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {ConnectedMonitorsList} from 'sentry/views/automations/components/connectedMonitorsList';
import {useConnectedDetectors} from 'sentry/views/automations/hooks/useConnectedDetectors';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';
import {useCanEditDetectorWorkflowConnections} from 'sentry/views/detectors/utils/useCanEditDetector';

const PROJECT_GROUPS = [
  {key: 'member', label: t('My Projects')},
  {key: 'all', label: t('Other')},
];

type MonitorMode = 'allProjects' | 'project' | 'specific';

interface Props {
  connectedIds: Automation['detectorIds'];
  setConnectedIds: (ids: Automation['detectorIds']) => void;
}

interface ContentProps extends Props {
  initialMode: MonitorMode;
}

function getInitialMonitorMode(connectedDetectors: Detector[]): MonitorMode {
  if (connectedDetectors.some(d => d.type === 'issue_stream' && d.projectId === null)) {
    return 'allProjects';
  }

  if (
    !connectedDetectors.length ||
    connectedDetectors.every(d => d.type === 'issue_stream')
  ) {
    return 'project';
  }

  return 'specific';
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
      <FormSection title={t('All Monitors')}>
        <Flex gap="xl">
          <ProjectPageFilter storageNamespace="automationDrawer" />
          <div style={{flexGrow: 1}}>
            <DetectorSearch initialQuery={searchQuery} onSearch={onSearch} />
          </div>
        </Flex>
        <ConnectedMonitorsList
          data-test-id="drawer-all-monitors-list"
          connectedDetectorIds={new Set(connectedIds)}
          toggleConnected={toggleConnected}
          emptyMessage={t('No monitors found')}
          cursor={cursor}
          onCursor={setCursor}
          query={searchQuery}
          projectIds={selection.projects}
          openInNewTab
        />
      </FormSection>
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
      queryClient.getQueryData(
        detectorListApiOptions(organization, {
          ids: localDetectorIds,
          includeIssueStreamDetectors: true,
        }).queryKey
      )?.json ?? [];

    const newDetectors = (
      oldDetectorsData.some(d => d.id === detector.id)
        ? oldDetectorsData.filter(d => d.id !== detector.id)
        : [...oldDetectorsData, detector]
    ).sort((a, b) => a.id.localeCompare(b.id)); // API will return ID ascending, so this avoids re-ordering
    const newDetectorIds = newDetectors.map(d => d.id);

    // Update the query cache to prevent the list from being fetched anew
    queryClient.setQueryData(
      detectorListApiOptions(organization, {
        ids: newDetectorIds,
        includeIssueStreamDetectors: true,
      }).queryKey,
      old => ({headers: old?.headers ?? {}, json: newDetectors})
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
}: {
  onProjectChange: (projectIds: string[]) => void;
}) {
  const {projects} = useProjects();

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
        />
      </Container>
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
      variant="primary"
      icon={<IconAdd />}
      onClick={toggleDrawer}
    >
      {t('Connect Monitors')}
    </Button>
  );
}

export const CONNECTED_MONITORS_ERROR_ID = 'connectedMonitors';

function EditConnectedMonitorsContent({
  initialMode,
  connectedIds,
  setConnectedIds,
}: ContentProps) {
  const [monitorMode, setMonitorMode] = useState<MonitorMode>(initialMode);
  const {form} = useContext(FormContext);
  const errorContext = useContext(AutomationBuilderErrorContext);
  const organization = useOrganization();

  const handleModeChange = useCallback(
    (newMode: MonitorMode) => {
      setMonitorMode(newMode);
      setConnectedIds([]);
      form?.setValue('projectIds', []);
      form?.setValue('allProjects', newMode === 'allProjects');
      if (newMode === 'allProjects') {
        errorContext?.removeError(CONNECTED_MONITORS_ERROR_ID);
      }
    },
    [errorContext, form, setConnectedIds]
  );
  const handleProjectChange = useCallback(
    (projectIds: string[]) => {
      if (projectIds.length) {
        errorContext?.removeError(CONNECTED_MONITORS_ERROR_ID);
      } else {
        setConnectedIds([]);
      }
    },
    [setConnectedIds, errorContext]
  );

  const handleSetConnectedIds = useCallback(
    (ids: Automation['detectorIds']) => {
      setConnectedIds(ids);
      if (ids.length) {
        errorContext?.removeError(CONNECTED_MONITORS_ERROR_ID);
      }
    },
    [setConnectedIds, errorContext]
  );

  const canEditAllProjects = useCanEditDetectorWorkflowConnections({projectId: null});

  const monitorModeChoices: Array<RadioOption<MonitorMode>> = [
    ['project', t('Alert on all issues in selected projects')],
    ['specific', t('Alert on specific monitors')],
  ];

  const disabledChoices: Array<[MonitorMode, React.ReactNode?]> = [];
  if (organization.features.includes('workflow-engine-all-projects-detector')) {
    monitorModeChoices.push(['allProjects', t('Alert on all issues in all projects')]);

    if (!canEditAllProjects) {
      disabledChoices.push([
        'allProjects',
        t('Only organization owners and managers can create global issue monitors.'),
      ]);
    }
  }

  return (
    <WorkflowEngineContainer>
      <FormSection
        title={t('Source')}
        description={t(
          'Get alerted when new issues are detected or an issue changes state.'
        )}
      >
        <Stack gap="lg">
          <RadioGroup
            label={t('Connected monitors mode')}
            value={monitorMode}
            choices={monitorModeChoices}
            disabledChoices={disabledChoices}
            onChange={handleModeChange}
          />
          {monitorMode === 'project' ? (
            <AllProjectIssuesSection onProjectChange={handleProjectChange} />
          ) : monitorMode === 'specific' ? (
            <SpecificMonitorsSection
              connectedIds={connectedIds}
              setConnectedIds={handleSetConnectedIds}
            />
          ) : null}
          {errorContext?.errors[CONNECTED_MONITORS_ERROR_ID] && (
            <Alert variant="danger">
              {errorContext.errors[CONNECTED_MONITORS_ERROR_ID]}
            </Alert>
          )}
        </Stack>
      </FormSection>
    </WorkflowEngineContainer>
  );
}

export function EditConnectedMonitors({connectedIds, setConnectedIds}: Props) {
  const {form} = useContext(FormContext);
  const [firstLoad, setFirstLoad] = useState(true);
  const {connectedDetectors, isLoading} = useConnectedDetectors();
  const initialMode = getInitialMonitorMode(connectedDetectors);

  useEffect(() => {
    if (isLoading || !firstLoad) {
      return;
    }
    setFirstLoad(false);

    if (initialMode === 'allProjects') {
      form?.setValue('allProjects', true);
      return;
    }

    if (initialMode !== 'project') {
      return;
    }

    // Sync the derived selectedProjectIds to the form model so the field can read from it
    const selectedProjectIds =
      connectedDetectors
        ?.filter(detector => connectedIds.includes(detector.id))
        .map(d => d.projectId)
        .filter(defined) ?? [];
    if (form && selectedProjectIds.length > 0) {
      form.setValue('projectIds', selectedProjectIds);
    }
  }, [connectedIds, connectedDetectors, form, firstLoad, isLoading, initialMode]);

  if (isLoading && firstLoad) {
    return (
      <WorkflowEngineContainer>
        <FormSection
          title={t('Source')}
          description={t(
            'Get alerted when new issues are detected or an issue changes state.'
          )}
        >
          <Placeholder width="100%" height="200px" />
        </FormSection>
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

const StyledSection = styled(FormSection)`
  margin-bottom: ${p => p.theme.space.lg};
`;
