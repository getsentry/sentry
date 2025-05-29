import {useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import EditConnectedMonitors from 'sentry/views/automations/components/editConnectedMonitors';
import {NEW_AUTOMATION_CONNECTED_IDS_KEY} from 'sentry/views/automations/hooks/utils';
import NewAutomationLayout from 'sentry/views/automations/layouts/new';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

export default function AutomationNew() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});

  const storageKey = NEW_AUTOMATION_CONNECTED_IDS_KEY;
  const [connectedIds, setConnectedIds] = useState<Set<string>>(
    new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))
  );
  const saveConnectedIds = () => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(connectedIds)));
  };
  const clearConnectedIds = () => {
    localStorage.removeItem(storageKey);
  };

  return (
    <NewAutomationLayout>
      <ContentWrapper>
        <Flex column gap={space(1.5)} style={{padding: space(2)}}>
          <Card>
            <EditConnectedMonitors
              connectedIds={connectedIds}
              setConnectedIds={setConnectedIds}
            />
          </Card>
          <span>
            <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
          </span>
        </Flex>
      </ContentWrapper>
      <StickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton
            priority="default"
            to={makeAutomationBasePathname(organization.slug)}
            onClick={clearConnectedIds}
          >
            {t('Cancel')}
          </LinkButton>
          <LinkButton priority="primary" to="settings" onClick={saveConnectedIds}>
            {t('Next')}
          </LinkButton>
        </Flex>
      </StickyFooter>
    </NewAutomationLayout>
  );
}

const ContentWrapper = styled('div')`
  position: relative;
`;
