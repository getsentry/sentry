import {Button} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Hovercard} from 'sentry/components/hovercard';
import {IconCheckmark, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

const AGENT_CAPABILITIES = [
  t('Detect your framework and language'),
  t('Create and configure a new Sentry project'),
  t('Install and instrument the Sentry SDK'),
  t('Verify a real error reaches Sentry'),
];

interface AgentInfoProps {
  onboardingCode?: string;
}

export function AgentInfo({onboardingCode}: AgentInfoProps) {
  return (
    <Hovercard
      position="top"
      body={
        <Stack gap="xl">
          <Stack gap="md">
            {AGENT_CAPABILITIES.map(capability => (
              <Grid key={capability} columns="16px 1fr" align="center" gap="md">
                <Flex justify="center">
                  <IconCheckmark size="sm" variant="success" />
                </Flex>
                <Text variant="muted" size="sm">
                  {capability}
                </Text>
              </Grid>
            ))}
          </Stack>
          {onboardingCode ? (
            <Grid columns="16px 1fr" align="start" gap="md">
              <Flex justify="center" paddingTop="2xs">
                <IconInfo size="xs" variant="secondary" />
              </Flex>
              <Text variant="muted" size="sm">
                {tct(
                  'Your agent uses ID [onboardingCode] to report setup progress here. Progress updates sent with this ID never include any part of your source code.',
                  {
                    onboardingCode: <InlineCode>{onboardingCode}</InlineCode>,
                  }
                )}
              </Text>
            </Grid>
          ) : null}
        </Stack>
      }
    >
      <Button variant="link" size="zero" icon={<IconInfo variant="secondary" />}>
        <Text size="sm" variant="muted" underline="dotted">
          {t('What will my agent do?')}
        </Text>
      </Button>
    </Hovercard>
  );
}
