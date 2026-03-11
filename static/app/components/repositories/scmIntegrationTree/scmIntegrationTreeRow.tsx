import {useEffect, useState, type CSSProperties, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import RepoProviderIcon from 'sentry/components/repositories/repoProviderIcon';
import type {TreeNode} from 'sentry/components/repositories/scmIntegrationTree/types';
import {IconAdd, IconChevron, IconDelete, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Integration, IntegrationRepository} from 'sentry/types/integrations';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import useTimeout from 'sentry/utils/useTimeout';

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

type Props = {
  node: TreeNode;
  onToggleIntegration: (integrationId: string) => void;
  onToggleProvider: (providerKey: string) => void;
  onToggleRepo: (
    repo: IntegrationRepository,
    integration: Integration,
    isConnected: boolean
  ) => void;
  orgSlug: string;
  style: CSSProperties;
};

export function ScmIntegrationTreeRow({
  node,
  onToggleProvider,
  onToggleIntegration,
  onToggleRepo,
  orgSlug,
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
                <LinkButton
                  size="xs"
                  icon={<IconAdd />}
                  to={`/settings/${orgSlug}/integrations/${node.provider.slug}/`}
                  disabled={!canAccess}
                >
                  {t('Install Config')}
                </LinkButton>
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
                  <LinkButton
                    size="xs"
                    icon={<IconAdd />}
                    to={`/settings/${orgSlug}/integrations/${node.provider.slug}/`}
                    disabled={!canAccess}
                  >
                    {t('Install Config')}
                  </LinkButton>
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
              {node.isReposPending ? (
                <LoadingReposMessage />
              ) : (
                <Badge variant="muted">
                  {t('%s/%s repos connected', node.connectedRepoCount, node.repoCount)}
                </Badge>
              )}
            </Flex>
          </Flex>
        </RowButton>
      </RowContainer>
    );
  }

  if (node.type === 'no-match') {
    let noMatchMessage: ReactNode;
    if (node.search && node.repoFilter !== 'all') {
      noMatchMessage =
        node.repoFilter === 'connected'
          ? tct('No added repos matching "[search]"', {search: node.search})
          : tct('No unconnected repos matching "[search]"', {search: node.search});
    } else if (node.search) {
      noMatchMessage = tct('No repos matching "[search]"', {search: node.search});
    } else {
      noMatchMessage =
        node.repoFilter === 'connected'
          ? t('No repos have been added yet')
          : t('All repos have been added');
    }
    return (
      <RowContainer style={style} role="row" aria-level={3}>
        <Flex align="center" gap="sm" height="100%" padding="0 lg 0 3xl">
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
            <LinkButton
              size="xs"
              icon={<IconAdd />}
              to={`/settings/${orgSlug}/integrations/${node.provider.slug}/`}
              disabled={!canAccess}
            >
              {t('Add %s Config', node.provider.name)}
            </LinkButton>
          </Tooltip>
        </Flex>
      </RowContainer>
    );
  }

  // node.type === 'repo'
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
          <Tooltip
            disabled={canAccess}
            title={t('You must be an organization owner, manager or admin to uninstall')}
          >
            <Confirm
              onConfirm={() => onToggleRepo(node.repo, node.integration, true)}
              disabled={!canAccess || node.isToggling}
              message={t(
                'Are you sure you want to remove %s? All associated commit data will be removed in addition to the repository.',
                <code>{node.repo.name}</code>
              )}
            >
              <Button
                size="xs"
                icon={<IconDelete />}
                disabled={!canAccess || node.isToggling}
                aria-label={t('Remove %s', node.repo.name)}
              >
                {t('Remove')}
              </Button>
            </Confirm>
          </Tooltip>
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
        {messages[messageIndex]}
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
  border-bottom: 1px solid ${p => p.theme.tokens.border.neutral.muted};
  &:last-child {
    border-bottom: none;
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
