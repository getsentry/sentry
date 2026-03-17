import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration, IntegrationRepository} from 'sentry/types/integrations';

import {RepoSelector} from './scmRepoSelector';

interface ConnectedViewProps {
  integration: Integration;
  onAddRepo: (repo: IntegrationRepository) => void;
  onDisconnect: () => void;
  onRemoveRepo: (identifier: string) => void;
  selectedRepos: IntegrationRepository[];
}

export function ConnectedView({
  integration,
  selectedRepos,
  onDisconnect,
  onAddRepo,
  onRemoveRepo,
}: ConnectedViewProps) {
  return (
    <Stack gap="lg">
      <Flex align="center" justify="between">
        <Flex align="center" gap="sm">
          <IconCheckmark variant="success" size="sm" />
          <Text bold variant="success">
            {t('Connected to %s', integration.domainName ?? integration.provider.name)}
          </Text>
        </Flex>
        <Button
          size="sm"
          priority="link"
          icon={<IconClose size="xs" />}
          onClick={onDisconnect}
        >
          {t('Disconnect')}
        </Button>
      </Flex>
      <RepoSelector
        integration={integration}
        selectedRepos={selectedRepos}
        onAddRepo={onAddRepo}
        onRemoveRepo={onRemoveRepo}
      />
    </Stack>
  );
}
