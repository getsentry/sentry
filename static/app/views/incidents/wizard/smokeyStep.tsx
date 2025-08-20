import {useEffect, useState} from 'react';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {
  IncidentSetupStep,
  useIncidentSetupContext,
} from 'sentry/views/incidents/wizard/context';
import {SlackDemo} from 'sentry/views/incidents/wizard/slackDemo';

export function SmokeyStep() {
  const {smokey: smokeyContext, setStepContext} = useIncidentSetupContext();

  const [hasMetSmokey, setHasMetSmokey] = useState(false);

  useEffect(() => {
    if (hasMetSmokey && !smokeyContext.complete) {
      setStepContext(IncidentSetupStep.SMOKEY, {complete: true});
    }
  }, [smokeyContext, setStepContext, hasMetSmokey]);

  return (
    <Flex wrap="wrap">
      <Flex direction="column" gap="lg" flex="1">
        <Heading as="h3" size="lg">
          {t('What forest fires?')}
        </Heading>
        <Text variant="muted" density="comfortable" size="lg">
          {tct(
            'Smokey is [already] connected to your Slack workspace and ready to help you with incidents.',
            {
              already: <i>already</i>,
            }
          )}
        </Text>
        <Text variant="muted" density="comfortable" size="lg">
          {t('Smokey has no AI.')} <b>{t('Yet.')}</b>
        </Text>
        <Text variant="muted" density="comfortable" size="lg">
          {t('But give it a shot anyway, he can lend a hand.')}
        </Text>
        <LinkButton
          icon={<PluginIcon pluginId="slack" />}
          href="slack://user?team=E099WAN089G&id=D09B9DYUXMF"
          style={{alignSelf: 'start'}}
          onClick={() => setHasMetSmokey(true)}
        >
          {t('Open Slack')}
        </LinkButton>
      </Flex>
      <SlackDemo />
    </Flex>
  );
}
