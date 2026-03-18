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
          {t('No active Seer subscription found for this organization.')}
        </Alert>
        <Container padding="2xl">
          <Text>
            {tct(
              "This organization has Seer settings configured, but there isn't an active Seer subscription right now. Manage your subscription in [billing:Billing] to continue using Seer features like Autofix and Code Review. Learn more in the [docs:docs].",
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
