import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export function ProblemSection() {
  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Problem')}</Heading>
      <Text>
        {t(
          'This span adds low-value detail to traces, which can make useful telemetry harder to scan. Review the instrumentation and remove or rename the span if it does not describe work you need to debug.'
        )}
      </Text>
    </Stack>
  );
}
