import {useMemo} from 'react';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout/flex';
import FormModel from 'sentry/components/forms/model';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import AutomationForm from 'sentry/views/automations/components/automationForm';
import NewAutomationLayout from 'sentry/views/automations/layouts/new';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

export default function AutomationNewSettings() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const model = useMemo(() => new FormModel(), []);

  return (
    <NewAutomationLayout>
      <AutomationForm model={model} />
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton
            priority="default"
            to={`${makeAutomationBasePathname(organization.slug)}new/`}
          >
            {t('Back')}
          </LinkButton>
          <Button priority="primary">{t('Create Automation')}</Button>
        </Flex>
      </StickyFooter>
    </NewAutomationLayout>
  );
}
