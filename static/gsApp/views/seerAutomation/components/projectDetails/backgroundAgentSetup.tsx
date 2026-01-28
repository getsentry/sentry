import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import FormField from 'sentry/components/forms/formField';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  supportedIntegrations: CodingAgentIntegration[];
}

export default function BackgroundAgentSetup({supportedIntegrations}: Props) {
  const organization = useOrganization();
  const formFields = [];

  if (
    organization.features.includes('integrations-cursor') &&
    !supportedIntegrations.some(integration => integration.provider === 'cursor')
  ) {
    formFields.push(<AddCursorIntegrationField />);
  }

  return formFields;
}

function AddCursorIntegrationField() {
  return (
    <FormField
      name="connectCursorIntegration"
      label={
        <Flex align="center" gap="sm">
          <PluginIcon pluginId="cursor" />
          <Text>
            {tct('Hand off to [docsLink:Cursor Cloud Agent].', {
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/organization/integrations/cursor/" />
              ),
            })}
          </Text>
        </Flex>
      }
    >
      {() => (
        <Flex>
          <LinkButton href="/settings/integrations/cursor/" priority="default" size="sm">
            {t('Install Cursor Integration')}
          </LinkButton>
        </Flex>
      )}
    </FormField>
  );
}
