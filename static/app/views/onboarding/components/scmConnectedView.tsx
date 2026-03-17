import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration, IntegrationRepository} from 'sentry/types/integrations';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {RepoSelector} from './scmRepoSelector';

interface ConnectedViewProps {
  integration: Integration;
  onSelectRepo: (repo: IntegrationRepository | null) => void;
  selectedRepo: IntegrationRepository | null;
}

export function ConnectedView({
  integration,
  selectedRepo,
  onSelectRepo,
}: ConnectedViewProps) {
  const organization = useOrganization();

  return (
    <Stack gap="lg">
      <Flex align="center" justify="between">
        <Flex align="center" gap="sm">
          <IconCheckmark variant="success" size="sm" />
          <Text bold variant="success">
            {t('Connected to %s', integration.domainName ?? integration.provider.name)}
          </Text>
        </Flex>
        <Link to={normalizeUrl(`/settings/${organization.slug}/integrations/`)} size="sm">
          {t('Manage in Settings')}
        </Link>
      </Flex>
      <RepoSelector
        integration={integration}
        selectedRepo={selectedRepo}
        onSelect={onSelectRepo}
      />
    </Stack>
  );
}
