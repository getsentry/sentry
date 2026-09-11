import {InlineCode} from '@sentry/scraps/code';
import {InfoText} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
    <InfoText
      position="top"
      maxWidth={320}
      size="md"
      variant="muted"
      title={
        <Stack gap="xl">
          <Stack gap="md">
            {AGENT_CAPABILITIES.map(capability => (
              <Grid key={capability} columns="16px 1fr" align="center" gap="md">
                <Flex justify="center">
                  <IconCheckmark size="sm" variant="success" />
                </Flex>
                <Text variant="muted" size="sm" align="left">
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
              <Text variant="muted" size="sm" align="left">
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
      {t('What your agent will do')}
    </InfoText>
  );
}
