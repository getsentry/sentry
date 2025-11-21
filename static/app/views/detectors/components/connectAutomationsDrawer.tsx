import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {getApiQueryData, setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {AutomationSearch} from 'sentry/views/automations/components/automationListTable/search';
import {makeAutomationsQueryKey} from 'sentry/views/automations/hooks';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';

function ConnectedAutomations({
  automationIds,
  toggleConnected,
}: {
  automationIds: string[];
  toggleConnected: (params: {automation: Automation}) => void;
}) {
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  return (
    <Section title={t('Connected Alerts')}>
      <ConnectedAutomationsList
        data-test-id="drawer-connected-automations-list"
        automationIds={automationIds}
        connectedAutomationIds={new Set(automationIds)}
        toggleConnected={toggleConnected}
        cursor={cursor}
        onCursor={setCursor}
        limit={null}
        openInNewTab
      />
    </Section>
  );
}

function AllAutomations({
  automationIds,
  toggleConnected,
}: {
  automationIds: string[];
  toggleConnected: (params: {automation: Automation}) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const onSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCursor(undefined);
  }, []);

  return (
    <Section title={t('All Alerts')}>
      <AutomationSearch initialQuery={searchQuery} onSearch={onSearch} />
      <ConnectedAutomationsList
        data-test-id="drawer-all-automations-list"
        automationIds={null}
        connectedAutomationIds={new Set(automationIds)}
        toggleConnected={toggleConnected}
        emptyMessage={t('No alerts found')}
        cursor={cursor}
        onCursor={setCursor}
        query={searchQuery}
        openInNewTab
      />
    </Section>
  );
}

export function ConnectAutomationsDrawer({
  initialWorkflowIds,
  setWorkflowIds,
}: {
  initialWorkflowIds: string[];
  setWorkflowIds: (workflowIds: string[]) => void;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [localWorkflowIds, setLocalWorkflowIds] = useState(initialWorkflowIds);

  const toggleConnected = ({automation}: {automation: Automation}) => {
    const oldAutomationsData =
      getApiQueryData<Automation[]>(
        queryClient,
        makeAutomationsQueryKey({
          orgSlug: organization.slug,
          ids: localWorkflowIds,
        })
      ) ?? [];

    const newAutomations = (
      oldAutomationsData.some(a => a.id === automation.id)
        ? oldAutomationsData.filter(a => a.id !== automation.id)
        : [...oldAutomationsData, automation]
    ).sort((a, b) => a.id.localeCompare(b.id));
    const newWorkflowIds = newAutomations.map(a => a.id);

    setApiQueryData<Automation[]>(
      queryClient,
      makeAutomationsQueryKey({
        orgSlug: organization.slug,
        ids: newWorkflowIds,
      }),
      newAutomations
    );

    setLocalWorkflowIds(newWorkflowIds);
    setWorkflowIds(newWorkflowIds);
  };

  return (
    <Fragment>
      <DrawerHeader hideBar />
      <DrawerContent>
        <ConnectedAutomations
          automationIds={localWorkflowIds}
          toggleConnected={toggleConnected}
        />
        <AllAutomations
          automationIds={localWorkflowIds}
          toggleConnected={toggleConnected}
        />
      </DrawerContent>
    </Fragment>
  );
}

const DrawerContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(2)} ${space(3)};
`;
