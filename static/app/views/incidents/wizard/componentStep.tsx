import {useEffect, useState} from 'react';

import {Button} from 'sentry/components/core/button/';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {TextArea} from 'sentry/components/core/textarea';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useOrganization from 'sentry/utils/useOrganization';
import {useCreateIncidentComponent} from 'sentry/views/incidents/hooks/useCreateIncidentComponent';
import {useIncidentComponents} from 'sentry/views/incidents/hooks/useIncidentComponents';
import {useMutateIncidentComponent} from 'sentry/views/incidents/hooks/useMutateIncidentComponent';
import {useStatuspageProxy} from 'sentry/views/incidents/hooks/useStatuspageProxy';
import type {IncidentComponent} from 'sentry/views/incidents/types';
import {
  IncidentSetupStep,
  useIncidentSetupContext,
} from 'sentry/views/incidents/wizard/context';

export function ComponentStep() {
  const organization = useOrganization();
  const {
    tools: toolsContext,
    components: componentsContext,
    setStepContext,
  } = useIncidentSetupContext();
  const {incidentComponents = []} = useIncidentComponents({
    organizationSlug: organization.slug,
  });

  const [componentName, setComponentName] = useState('');
  const [componentDescription, setComponentDescription] = useState('');
  const {createMutation} = useCreateIncidentComponent({
    organizationSlug: organization.slug,
  });

  const {listComponents} = useStatuspageProxy({organizationSlug: organization.slug});
  const statuspageId = toolsContext?.status_page_config?.statuspage?.id;

  useEffect(() => {
    if (incidentComponents.length > 0 && !componentsContext.complete) {
      setStepContext(IncidentSetupStep.COMPONENTS, {complete: true});
    }
  }, [incidentComponents, componentsContext.complete, setStepContext]);

  return (
    <Flex gap="xl" maxWidth="600px" direction="column">
      <Text variant="muted">
        {t(
          'Components are the building blocks of your application that can experience issues. Add the key services, databases, and external dependencies that your team needs to monitor.'
        )}
      </Text>
      <Flex direction="column" gap="lg">
        <Flex direction="column" gap="md">
          <Flex direction="column">
            <Text size="sm" bold>
              {t('Component Name')}
            </Text>
            <Input
              size="sm"
              placeholder={t('e.g., API, Notifications, Payments, Mobile App')}
              value={componentName}
              onChange={e => setComponentName(e.target.value)}
            />
          </Flex>
          <Flex direction="column">
            <Text size="sm" bold>
              {t('Component Description')}
            </Text>
            <TextArea
              size="sm"
              placeholder={t(
                'e.g., If this service is down users may be experiencing issues accessing our website and mobile app.'
              )}
              rows={2}
              value={componentDescription}
              onChange={e => setComponentDescription(e.target.value)}
            />
          </Flex>
          <Flex gap="sm" justify="end">
            <Button
              size="xs"
              icon={<PluginIcon pluginId="statuspage" />}
              onClick={() => listComponents.mutate({page_id: statuspageId})}
              disabled={!statuspageId}
            >
              {t('Sync w/ Statuspage')}
            </Button>
            <Button
              size="xs"
              priority="primary"
              onClick={() =>
                createMutation.mutate({
                  name: componentName,
                  description: componentDescription,
                })
              }
              disabled={!componentName}
            >
              {t('Add Component')}
            </Button>
          </Flex>
        </Flex>
      </Flex>
      <Flex direction="column" gap="sm">
        {incidentComponents.map(component => (
          <IncidentComponentItem key={component.id} component={component} />
        ))}
      </Flex>
    </Flex>
  );
}

function IncidentComponentItem({component}: {component: IncidentComponent}) {
  const organization = useOrganization();
  const {deleteMutation} = useMutateIncidentComponent({
    organizationSlug: organization.slug,
    componentId: component.id,
  });
  return (
    <Flex
      justify="between"
      align="center"
      padding="sm xl"
      radius="md"
      background="secondary"
    >
      <Flex direction="column" gap="xs">
        <Text bold>{component.name}</Text>
        <Text>{component.description}</Text>
      </Flex>
      <Button
        size="xs"
        onClick={() => deleteMutation.mutate()}
        icon={<IconDelete />}
        aria-label={t('Delete Component')}
      />
    </Flex>
  );
}
