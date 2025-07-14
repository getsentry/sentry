import {Fragment, useCallback, useContext, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import FormContext from 'sentry/components/forms/formContext';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd, IconEdit} from 'sentry/icons';
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
    <Section title={t('Connected Automations')}>
      <ConnectedAutomationsList
        data-test-id="drawer-connected-automations-list"
        automationIds={automationIds}
        connectedAutomationIds={new Set(automationIds)}
        toggleConnected={toggleConnected}
        cursor={cursor}
        onCursor={setCursor}
        limit={null}
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

  return (
    <Section title={t('All Automations')}>
      <AutomationSearch
        initialQuery={searchQuery}
        onSearch={query => setSearchQuery(query)}
      />
      <ConnectedAutomationsList
        data-test-id="drawer-all-automations-list"
        automationIds={null}
        connectedAutomationIds={new Set(automationIds)}
        toggleConnected={toggleConnected}
        emptyMessage={t('No automations found')}
        cursor={cursor}
        onCursor={setCursor}
        query={searchQuery}
      />
    </Section>
  );
}

function ConnectAutomationsDrawer({
  initialWorkflowIds,
  setWorkflowIds,
}: {
  initialWorkflowIds: string[];
  setWorkflowIds: (workflowIds: string[]) => void;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  // Because GlobalDrawer is rendered outside of our form context, we need to duplicate the state here
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
    ).sort((a, b) => a.id.localeCompare(b.id)); // API will return ID ascending, so this avoids re-ordering
    const newWorkflowIds = newAutomations.map(a => a.id);

    // Update the query cache to prevent the list from being fetched anew
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

export function AutomateSection() {
  const ref = useRef<HTMLButtonElement>(null);
  const formContext = useContext(FormContext);
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();

  const workflowIds = useFormField('workflowIds') as string[];
  const setWorkflowIds = useCallback(
    (newWorkflowIds: string[]) =>
      formContext.form?.setValue('workflowIds', newWorkflowIds),
    [formContext.form]
  );

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer(
      () => (
        <ConnectAutomationsDrawer
          initialWorkflowIds={workflowIds}
          setWorkflowIds={setWorkflowIds}
        />
      ),
      {
        ariaLabel: t('Connect Automations'),
        shouldCloseOnInteractOutside: el => {
          if (!ref.current) {
            return true;
          }
          return !ref.current.contains(el);
        },
      }
    );
  };

  if (workflowIds.length > 0) {
    return (
      <Container>
        <Section title={t('Connected Automations')}>
          <ConnectedAutomationsList
            automationIds={workflowIds}
            cursor={undefined}
            onCursor={() => {}}
            limit={null}
          />
        </Section>
        <ButtonWrapper justify="space-between">
          {/* TODO: Implement create automation flow */}
          <Button size="sm" icon={<IconAdd />} disabled>
            {t('Create New Automation')}
          </Button>
          <Button size="sm" icon={<IconEdit />} onClick={toggleDrawer}>
            {t('Edit Automations')}
          </Button>
        </ButtonWrapper>
      </Container>
    );
  }

  return (
    <Container>
      <Section title={t('Automate')} description={t('Set up alerts or notifications.')}>
        <Button
          ref={ref}
          size="sm"
          style={{width: 'min-content'}}
          priority="primary"
          icon={<IconAdd />}
          onClick={toggleDrawer}
        >
          {t('Connect an Automation')}
        </Button>
      </Section>
    </Container>
  );
}

const DrawerContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(2)} ${space(3)};
`;

const ButtonWrapper = styled(Flex)`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  margin: -${space(2)};
`;
