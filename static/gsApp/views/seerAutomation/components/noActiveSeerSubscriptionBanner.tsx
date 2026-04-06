import {Alert} from '@sentry/scraps/alert';
import {Container, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function NoActiveSeerSubscriptionBanner() {
  const organization = useOrganization();

  return (
    <Container border="warning" radius="md" overflow="hidden">
      <Stack>
        <Alert system showIcon={false} variant="warning">
          {t('You are using an older Seer experience.')}
        </Alert>
        <Container padding="2xl">
          <Text>
            {tct(
              'You can continue using Seer features like Autofix and Code Review for now. To keep uninterrupted access as Seer plans evolve, set up a Seer subscription in [billing:Billing]. Learn more in the [docs:docs].',
              {
                billing: (
                  <Link
                    to={`/settings/${organization.slug}/billing/overview/?product=seer`}
                  />
                ),
                docs: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/" />
                ),
              }
            )}
          </Text>
        </Container>
      </Stack>
    </Container>
  );
}
