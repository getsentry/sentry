import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';

export function ProblemSection() {
  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Problem')}</Heading>
      <Text>
        {t(
          "Your source maps aren't configured correctly, so stack traces will show minified code instead of your original source. Fix this to see the exact file, line, and function causing the error."
        )}
      </Text>
      <div>
        <LinkButton
          size="sm"
          icon={<IconInfo />}
          external
          // TODO Abdullah Khan: Look into adding platform specific links to source map docs
          href="https://docs.sentry.io/platforms/javascript/sourcemaps/"
        >
          {t('Why configure source maps?')}
        </LinkButton>
      </div>
    </Stack>
  );
}
