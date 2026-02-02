import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export function Acronym() {
  return (
    <Stack align="start" gap="xl" width="100%">
      <Text as="p" size="2xl" density="comfortable">
        <Text as="span" variant="accent" bold>
          SCRAPS{' '}
        </Text>
        <Text as="span">is our design system&mdash;also known as the&hellip;</Text>
      </Text>
      <Text as="p" size="2xl" density="comfortable">
        <Text as="span" variant="accent" bold>
          S
        </Text>
        <span>tandardized</span>{' '}
        <Text as="span" variant="accent" bold>
          C
        </Text>
        <span>ollection of</span>{' '}
        <Text as="span" variant="accent" bold>
          R
        </Text>
        <span>eusable</span>{' '}
        <Text as="span" variant="accent" bold>
          A
        </Text>
        <span>ssets and</span>{' '}
        <Text as="span" variant="accent" bold>
          P
        </Text>
        <span>atterns for</span>{' '}
        <Text as="span" variant="accent" bold>
          S
        </Text>
        <span>entry</span>
      </Text>
    </Stack>
  );
}
