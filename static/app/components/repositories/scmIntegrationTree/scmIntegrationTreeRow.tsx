import {useEffect, useState, type CSSProperties, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {ProviderConfigLink} from 'sentry/components/repositories/scmIntegrationTree/providerConfigLink';
import type {TreeNode} from 'sentry/components/repositories/scmIntegrationTree/types';
import {IconAdd, IconChevron, IconClose, IconDelete, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTimeout} from 'sentry/utils/useTimeout';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

type Props = {
  node: TreeNode;
  onAddIntegration: () => void;
  onRemoveDisconnectedRepo: (repo: Repository) => void;
  onToggleIntegration: (integrationId: string) => void;
  onToggleProvider: (providerKey: string) => void;
  onToggleRepo: (
    repo: IntegrationRepository,
    integration: Integration,
    isConnected: boolean
  ) => void;
  style: CSSProperties;
};

export function ScmIntegrationTreeRow({
  node,
  onAddIntegration,
  onToggleProvider,
  onToggleIntegration,
  onToggleRepo,
  onRemoveDisconnectedRepo,
  style,
}: Props) {
  const organization = useOrganization();
  const canAccess =
    hasEveryAccess(['org:integrations'], {organization}) || isActiveSuperuser();

  if (node.type === 'provider') {
    if (node.integrationCount === 0) {
      return (
        <RowContainer style={style} role="row" aria-level={1}>
          <Flex
            align="center"
            gap="lg"
            flex={1}
            height="100%"
            paddingLeft="3xl"
            paddingRight="lg"
          >
            <Flex align="center" gap="sm" flex={1} justify="between">
              <Flex align="center" gap="sm">
                <RepoProviderIcon
                  provider={`integrations:${node.provider.key}`}
                  size="sm"
                />
                <Text bold size="md">
                  {node.provider.name}
                </Text>
              </Flex>

              <Tooltip
                disabled={canAccess}
                position="left"
                title={t(
                  'You must be an organization owner, manager or admin to configure'
                )}
              >
                <AddIntegrationButton
                  size="xs"
                  icon={<IconAdd />}
                  provider={node.provider}
                  organization={organization}
                  onAddIntegration={onAddIntegration}
                  disabled={!canAccess || !node.provider.canAdd}
                  buttonText={t('Install Config')}
                />
              </Tooltip>
            </Flex>
          </Flex>
        </RowContainer>
      );
    }
    return (
      <RowContainer style={style} role="row" aria-level={1}>
        <RowButton
          onClick={() => onToggleProvider(node.provider.key)}
          aria-expanded={node.isExpanded}
          aria-label={node.provider.name}
        >
          <InteractionStateLayer hasSelectedBackground={false} />
          <Flex align="center" gap="lg" flex={1}>
            <IconChevron direction={node.isExpanded ? 'down' : 'right'} size="xs" />
            <Flex align="center" gap="sm" flex={1} justify="between">
              <Flex align="center" gap="sm">
                <RepoProviderIcon
                  provider={`integrations:${node.provider.key}`}
                  size="sm"
                />
                <Text bold size="md">
                  {node.provider.name}
                </Text>
              </Flex>

              <Flex align="center" gap="lg">
                <Badge variant="muted">{t('%s configs', node.integrationCount)}</Badge>
                <Tooltip
                  disabled={canAccess}
                  position="left"
                  title={t(
                    'You must be an organization owner, manager or admin to configure'
                  )}
                >
                  <AddIntegrationButton
                    size="xs"
                    icon={<IconAdd />}
                    provider={node.provider}
                    organization={organization}
                    onAddIntegration={onAddIntegration}
                    disabled={!canAccess || !node.provider.canAdd}
                    buttonText={t('Install Config')}
                  />
                </Tooltip>
              </Flex>
            </Flex>
          </Flex>
        </RowButton>
      </RowContainer>
    );
  }

  if (node.type === 'integration') {
    return (
      <RowContainer style={style} role="row" aria-level={2}>
        <RowButton
          onClick={() => onToggleIntegration(node.integration.id)}
          aria-expanded={node.isExpanded}
          aria-label={node.integration.name}
        >
          <InteractionStateLayer hasSelectedBackground={false} />
          <Flex align="center" gap="lg" flex={1} height="100%" paddingLeft="2xl">
            <IconChevron direction={node.isExpanded ? 'down' : 'right'} size="xs" />
            <Flex align="center" gap="sm" flex={1} height="100%" justify="between">
              <Flex align="center" gap="sm">
                {node.integration.icon && (
                  <img
                    src={node.integration.icon}
                    alt={node.integration.name}
                    width={16}
                    height={16}
                  />
                )}
                <Text size="md">
                  {node.integration.name}
                  {node.integration.domainName && (
                    <Text variant="muted"> &mdash; {node.integration.domainName}</Text>
                  )}
                </Text>
              </Flex>
              <Flex align="center" gap="sm">
                {node.isReposPending ? (
                  <LoadingReposMessage />
                ) : (
                  <Badge variant="muted">
                    {t('%s/%s repos connected', node.connectedRepoCount, node.repoCount)}
                  </Badge>
                )}
                <ProviderConfigLink integration={node.integration} />
              </Flex>
            </Flex>
          </Flex>
        </RowButton>
      </RowContainer>
    );
  }

  if (node.type === 'no-match') {
    let noMatchMessage: ReactNode;
    if (node.search) {
      noMatchMessage = tct('No repos matching "[search]"', {search: node.search});
    } else {
      noMatchMessage =
        node.repoFilter === 'connected'
          ? t('No repos have been added yet')
          : t('All repos have been added');
    }
    return (
      <RowContainer style={style} role="row" aria-level={3}>
        <Flex align="center" gap="sm" height="100%" padding="0 lg 0 3xl" marginLeft="2xl">
          <Text size="md" variant="muted">
            {noMatchMessage}
          </Text>
        </Flex>
      </RowContainer>
    );
  }

  if (node.type === 'add-config') {
    return (
      <RowContainer style={style} role="row" aria-level={3}>
        <Flex align="center" gap="sm" height="100%" justify="end" padding="0 lg 0 3xl">
          <Tooltip
            disabled={canAccess}
            position="left"
            title={t('You must be an organization owner, manager or admin to configure')}
          >
            <AddIntegrationButton
              size="xs"
              icon={<IconAdd />}
              provider={node.provider}
              organization={organization}
              onAddIntegration={onAddIntegration}
              disabled={!canAccess}
              buttonText={t('Add %s Config', node.provider.name)}
            />
          </Tooltip>
        </Flex>
      </RowContainer>
    );
  }

  if (node.type === 'disconnected-section') {
    return (
      <RowContainer style={style} role="row" aria-level={1}>
        <RowButton
          onClick={() => onToggleProvider('__disconnected__')}
          aria-expanded={node.isExpanded}
          aria-label={t('Other repositories')}
        >
          <InteractionStateLayer hasSelectedBackground={false} />
          <Flex align="center" gap="lg" flex={1}>
            <IconChevron direction={node.isExpanded ? 'down' : 'right'} size="xs" />
            <Flex align="center" gap="sm" flex={1} justify="between">
              <Text bold size="md">
                {t('Other')}
              </Text>
              <Badge variant="muted">{t('%s repos', node.repoCount)}</Badge>
            </Flex>
          </Flex>
        </RowButton>
      </RowContainer>
    );
  }

  if (node.type === 'disconnected-repo') {
    return (
      <DisconnectedRepoRow
        node={node}
        style={style}
        canAccess={canAccess}
        onRemoveDisconnectedRepo={onRemoveDisconnectedRepo}
      />
    );
  }

  // node.type === 'repo'
  return (
    <RepoRow
      node={node}
      style={style}
      canAccess={canAccess}
      onToggleRepo={onToggleRepo}
    />
  );
}

function RepoRow({
  node,
  style,
  canAccess,
  onToggleRepo,
}: {
  canAccess: boolean;
  node: Extract<TreeNode, {type: 'repo'}>;
  onToggleRepo: Props['onToggleRepo'];
  style: CSSProperties;
}) {
  return (
    <RowContainer style={style} role="row" aria-level={3}>
      <Flex align="center" gap="sm" height="100%" paddingRight="lg">
        <Flex
          flex={1}
          align="center"
          gap="sm"
          height="100%"
          marginLeft="2xl"
          paddingLeft="3xl"
        >
          {node.integration.domainName ? (
            <ExternalLink
              href={`https://${node.integration.domainName}/${node.repo.name}`}
            >
              <Flex align="center" gap="sm">
                {node.integration.domainName}/{node.repo.name}
                <IconOpen size="xs" />
              </Flex>
            </ExternalLink>
          ) : (
            <Text size="md">{node.repo.name}</Text>
          )}
          {node.repo.isInstalled && !node.isConnected && (
            <Text size="sm" variant="muted">
              {t('Already added elsewhere')}
            </Text>
          )}
        </Flex>
        {node.isConnected ? (
          <RemoveButton
            repoName={node.repo.name}
            isToggling={node.isToggling}
            canAccess={canAccess}
            onRemove={() => onToggleRepo(node.repo, node.integration, true)}
          />
        ) : (
          <Tooltip
            disabled={canAccess}
            title={t('You must be an organization owner, manager or admin to configure')}
          >
            <Button
              size="xs"
              icon={<IconAdd />}
              disabled={!canAccess || node.isToggling}
              onClick={() => onToggleRepo(node.repo, node.integration, false)}
              aria-label={t('Add %s', <code>{node.repo.name}</code>)}
            >
              {t('Add')}
            </Button>
          </Tooltip>
        )}
      </Flex>
    </RowContainer>
  );
}

function DisconnectedRepoRow({
  node,
  style,
  canAccess,
  onRemoveDisconnectedRepo,
}: {
  canAccess: boolean;
  node: Extract<TreeNode, {type: 'disconnected-repo'}>;
  onRemoveDisconnectedRepo: Props['onRemoveDisconnectedRepo'];
  style: CSSProperties;
}) {
  return (
    <RowContainer style={style} role="row" aria-level={3}>
      <Flex align="center" gap="sm" height="100%" paddingRight="lg">
        <Flex
          flex={1}
          align="center"
          gap="sm"
          height="100%"
          marginLeft="2xl"
          paddingLeft="3xl"
        >
          <ExternalLink href={node.repo.url}>
            <Flex align="center" gap="sm">
              {node.repo.name}
              <IconOpen size="xs" />
            </Flex>
          </ExternalLink>
        </Flex>
        <RemoveButton
          repoName={node.repo.name}
          isToggling={node.isToggling}
          canAccess={canAccess}
          onRemove={() => onRemoveDisconnectedRepo(node.repo)}
        />
      </Flex>
    </RowContainer>
  );
}

function RemoveButton({
  repoName,
  isToggling,
  canAccess,
  onRemove,
}: {
  canAccess: boolean;
  isToggling: boolean;
  onRemove: () => void;
  repoName: string;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <Flex align="center" gap="sm">
        <Button
          size="xs"
          priority="danger"
          disabled={isToggling}
          onClick={() => {
            onRemove();
            setIsConfirming(false);
          }}
          aria-label={t('Confirm remove %s', repoName)}
        >
          {t('Confirm')}
        </Button>
        <Button
          size="xs"
          icon={<IconClose size="xs" />}
          disabled={isToggling}
          onClick={() => setIsConfirming(false)}
          aria-label={t('Cancel')}
        />
      </Flex>
    );
  }

  return (
    <Tooltip
      disabled={canAccess}
      title={t('You must be an organization owner, manager or admin to uninstall')}
    >
      <Button
        size="xs"
        icon={<IconDelete />}
        disabled={!canAccess || isToggling}
        onClick={() => setIsConfirming(true)}
        aria-label={t('Remove %s', repoName)}
      >
        {t('Remove')}
      </Button>
    </Tooltip>
  );
}

function LoadingReposMessage() {
  const [messageIndex, setMessageIndex] = useState(0);
  const {start} = useTimeout({
    timeMs: 5000,
    onTimeout: () => {
      setMessageIndex(prev => prev + 1);
      start();
    },
  });
  useEffect(start, [start]);

  const messages = [
    t('Loading repos...'),
    t('Loading a few repos...'),
    t('Loading a lot more repos...'),
    t('This is getting interesting...'),
    t('Almost done...'),
    t('Just kidding, still loading...'),
  ];

  return (
    <Flex align="center" gap="sm">
      <Text size="sm" variant="muted">
        {messages[Math.min(messageIndex, messages.length - 1)]}
      </Text>
      <LoadingIndicator size={16} />
    </Flex>
  );
}

const RowContainer = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  &:not(:last-child)::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    border-bottom: 1px solid ${p => p.theme.tokens.border.neutral.muted};
  }
`;

const RowButton = styled('button')`
  display: flex;
  width: 100%;
  height: 100%;
  background: none;
  padding: 0 ${p => p.theme.space.lg} 0 ${p => p.theme.space.md};
  border: none;
  cursor: pointer;
  position: relative;
`;
