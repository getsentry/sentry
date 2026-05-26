import {Disclosure} from '@sentry/scraps/disclosure';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export function TroubleshootingSection() {
  return (
    <Stack gap="md" padding="lg">
      <Heading as="h3">{t('Troubleshooting suggestions')}</Heading>
      <Stack gap="sm">
        <Disclosure size="md" defaultExpanded>
          <Disclosure.Title>{t('Confirm the Span Is Useful')}</Disclosure.Title>
          <Disclosure.Content>
            <Text>
              {t(
                'Keep spans that describe meaningful work, such as database calls, RPCs, jobs, or expensive operations. Remove spans that duplicate parent spans or only wrap framework internals.'
              )}
            </Text>
          </Disclosure.Content>
        </Disclosure>
        <Disclosure size="md">
          <Disclosure.Title>{t('Adjust Instrumentation')}</Disclosure.Title>
          <Disclosure.Content>
            <Text>
              {t(
                'Update custom instrumentation to skip this operation, or change its name and attributes so it groups with spans that share the same purpose.'
              )}
            </Text>
          </Disclosure.Content>
        </Disclosure>
        <Disclosure size="md">
          <Disclosure.Title>
            {t('Review SDK and OpenTelemetry Configuration')}
          </Disclosure.Title>
          <Disclosure.Content>
            <Text>
              {t(
                'Check automatic instrumentation settings before changing application code. Some SDK or OpenTelemetry integrations can be tuned to avoid noisy spans at the source.'
              )}
            </Text>
          </Disclosure.Content>
        </Disclosure>
      </Stack>
    </Stack>
  );
}
