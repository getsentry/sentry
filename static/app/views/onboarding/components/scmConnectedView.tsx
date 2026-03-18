import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ScmRepoSelector} from './scmRepoSelector';

export function ScmConnectedView() {
  const organization = useOrganization();
  const {selectedIntegration} = useOnboardingContext();

  if (!selectedIntegration) {
    return null;
  }

  return (
    <Stack gap="lg">
      <Flex align="center" justify="between">
        <Flex align="center" gap="sm">
          <IconCheckmark variant="success" size="sm" />
          <Text bold variant="success">
            {t(
              'Connected to %s',
              selectedIntegration.domainName ?? selectedIntegration.provider.name
            )}
          </Text>
        </Flex>
        <Link to={normalizeUrl(`/settings/${organization.slug}/integrations/`)}>
          {t('Manage in Settings')}
        </Link>
      </Flex>
      <ScmRepoSelector />
    </Stack>
  );
}
