import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {flattie} from 'flattie';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {DebugForm} from 'sentry/components/workflowEngine/form/debug';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import AutomationBuilder from 'sentry/views/automations/components/automationBuilder';
import {
  AutomationBuilderContext,
  initialAutomationBuilderState,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import ConnectedMonitorsList from 'sentry/views/automations/components/connectedMonitorsList';
import EditConnectedMonitors from 'sentry/views/automations/components/editConnectedMonitors';
import {
  NEW_AUTOMATION_CONNECTED_IDS_KEY,
  useConnectedIds,
} from 'sentry/views/automations/hooks/utils';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

const FREQUENCY_OPTIONS = [
  {value: '5', label: t('5 minutes')},
  {value: '10', label: t('10 minutes')},
  {value: '30', label: t('30 minutes')},
  {value: '60', label: t('60 minutes')},
  {value: '180', label: t('3 hours')},
  {value: '720', label: t('12 hours')},
  {value: '1440', label: t('24 hours')},
  {value: '10080', label: t('1 week')},
  {value: '43200', label: t('30 days')},
];

export default function AutomationForm() {
  const organization = useOrganization();
  const title = useDocumentTitle();
  const {state, actions} = useAutomationBuilderReducer();
  const [model] = useState(() => new FormModel());

  useEffect(() => {
    model.setValue('name', title);
  }, [title, model]);

  const monitors: Detector[] = []; // TODO: Fetch monitors from API
  const storageKey = NEW_AUTOMATION_CONNECTED_IDS_KEY; // TODO: use automation id for storage key when editing an existing automation
  const {connectedIds, toggleConnected} = useConnectedIds({
    storageKey,
  });
  const connectedMonitors = monitors.filter(monitor => connectedIds.has(monitor.id));

  const {openDrawer: openEditMonitorsDrawer, isDrawerOpen: isEditMonitorsDrawerOpen} =
    useDrawer();

  const showEditMonitorsDrawer = () => {
    if (!isEditMonitorsDrawerOpen) {
      openEditMonitorsDrawer(
        () => (
          <div>
            <DrawerHeader />
            <DrawerBody>
              <EditConnectedMonitors storageKey={storageKey} />
            </DrawerBody>
          </div>
        ),
        {
          ariaLabel: 'Edit Monitors Drawer',
          drawerKey: 'edit-monitors-drawer',
        }
      );
    }
  };

  return (
    <Form
      hideFooter
      model={model}
      initialData={{...flattie(initialAutomationBuilderState), frequency: '1440'}}
    >
      <AutomationBuilderContext.Provider value={{state, actions}}>
        <Flex column gap={space(1.5)} style={{padding: space(2)}}>
          <Card>
            <Heading>{t('Connect Monitors')}</Heading>
            <ConnectedMonitorsList
              monitors={connectedMonitors}
              connectedMonitorIds={connectedIds}
              toggleConnected={toggleConnected}
            />
            <ButtonWrapper justify="space-between">
              <LinkButton
                icon={<IconAdd />}
                to={`${makeMonitorBasePathname(organization.slug)}new/`}
              >
                {t('Create New Monitor')}
              </LinkButton>
              <Button icon={<IconEdit />} onClick={showEditMonitorsDrawer}>
                {t('Edit Monitors')}
              </Button>
            </ButtonWrapper>
          </Card>
          <Card>
            <Heading>{t('Automation Builder')}</Heading>
            <AutomationBuilder />
          </Card>
          <Card>
            <Heading>{t('Action Interval')}</Heading>
            <EmbeddedSelectField
              name="frequency"
              inline={false}
              clearable={false}
              options={FREQUENCY_OPTIONS}
            />
          </Card>
          <DebugForm />
        </Flex>
      </AutomationBuilderContext.Provider>
    </Form>
  );
}

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
`;

const ButtonWrapper = styled(Flex)`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  margin: -${space(2)};
`;

const EmbeddedSelectField = styled(SelectField)`
  padding: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  text-transform: none;
`;
