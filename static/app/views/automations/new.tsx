import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Button, LinkButton} from 'sentry/components/core/button';
import {Card} from 'sentry/components/workflowEngine/ui/card';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EditConnectedMonitors from 'sentry/views/automations/components/editConnectedMonitors';
import NewAutomationLayout from 'sentry/views/automations/layouts/new';

export default function AutomationNew() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <NewAutomationLayout>
      <ContentWrapper>
        <Flex column gap={space(1.5)} style={{padding: space(2)}}>
          <Card>
            <EditConnectedMonitors />
          </Card>
          <span>
            <Button icon={<IconAdd />}>{t('Create New Monitor')}</Button>
          </span>
        </Flex>
      </ContentWrapper>
      <StyledStickyFooter>
        <StickyFooterLabel>{t('Step 1 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton priority="default" to="/issues/automations">
            {t('Cancel')}
          </LinkButton>
          <LinkButton priority="primary" to="settings">
            {t('Next')}
          </LinkButton>
        </Flex>
      </StyledStickyFooter>
    </NewAutomationLayout>
  );
}

const ContentWrapper = styled('div')`
  position: relative;
`;

const StyledStickyFooter = styled(StickyFooter)`
  z-index: ${p => p.theme.zIndex.initial};
`;
