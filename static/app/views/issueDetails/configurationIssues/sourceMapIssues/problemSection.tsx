import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';

interface ProblemSectionProps {
  sourcemapsDocsUrl: string;
}

export function ProblemSection({sourcemapsDocsUrl}: ProblemSectionProps) {
  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Problem')}</Heading>
      <Text>
        {t(
          "Your source maps aren't configured correctly, so stack traces will show minified code instead of your original source. Fix this to see the exact file, line, and function causing the error."
        )}
      </Text>
      <div>
        <LinkButton size="sm" icon={<IconInfo />} external href={sourcemapsDocsUrl}>
          {t('Why configure source maps?')}
        </LinkButton>
      </div>
    </Stack>
  );
}
