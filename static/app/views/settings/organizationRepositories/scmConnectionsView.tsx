import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hideRepository} from 'sentry/actionCreators/integrations';
import {openModal} from 'sentry/actionCreators/modal';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {BackendJsonFormAdapter} from 'sentry/components/backendJsonFormAdapter';
import type {FieldValue} from 'sentry/components/backendJsonFormAdapter/types';
import {openConfirmModal} from 'sentry/components/confirm';
import {Confirm} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {ProviderConfigLink} from 'sentry/components/repositories/scmIntegrationTree/providerConfigLink';
import {useScmIntegrationTreeData} from 'sentry/components/repositories/scmIntegrationTree/useScmIntegrationTreeData';
import {
  IconChevron,
  IconEllipsis,
  IconOpen,
  IconSettings,
  IconSubtract,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  IntegrationProvider,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {fetchMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AddIntegration} from 'sentry/views/settings/organizationIntegrations/addIntegration';
import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';
import {IntegrationReposAddRepository} from 'sentry/views/settings/organizationIntegrations/integrationReposAddRepository';

// ─────────────────────────────────────────────────────────────
// Data hook
// ─────────────────────────────────────────────────────────────

export function useScmConnectionsData() {
  const {
    scmProviders,
    scmIntegrations,
    connectedRepos,
    refetchIntegrations,
    isPending,
    isError,
  } = useScmIntegrationTreeData();

  return {
    scmProviders,
    scmIntegrations,
    connectedRepos,
    refetchIntegrations,
    hasConnections: scmIntegrations.length > 0,
    isPending,
    isError,
  };
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function ScmConnectionsView() {
  const data = useScmConnectionsData();

  if (data.isPending) {
    return (
      <Flex justify="center" padding="xl" minHeight={200}>
        <LoadingIndicator />
      </Flex>
    );
  }

  if (data.isError) {
    return <LoadingError />;
  }

  if (!data.hasConnections) {
    return (
      <EmptyState
        providers={data.scmProviders}
        onAddIntegration={data.refetchIntegrations}
      />
    );
  }

  // Group integrations by provider
  const providerKeys = [...new Set(data.scmIntegrations.map(i => i.provider.key))];

  return (
    <Stack gap="xl">
      {providerKeys.map(key => {
        const provider = data.scmProviders.find(p => p.key === key);
        if (!provider) {
          return null;
        }
        const integrations = data.scmIntegrations.filter(i => i.provider.key === key);
        return (
          <ProviderSection
            key={key}
            provider={provider}
            integrations={integrations}
            connectedRepos={data.connectedRepos}
            refetchIntegrations={data.refetchIntegrations}
          />
        );
      })}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────

function EmptyState({
  providers,
  onAddIntegration,
}: {
  onAddIntegration: () => void;
  providers: IntegrationProvider[];
}) {
  return (
    <DashedContainer>
      <Text size="lg" align="center">
        {t(
          'Connect your source code to unlock Suspect Commits, Suggested Assignees, and Seer'
        )}
      </Text>
      <ProviderDropdown
        providers={providers}
        onAddIntegration={onAddIntegration}
        buttonText={t('Connect a provider')}
        size="sm"
        priority="primary"
      />
    </DashedContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// Provider section — title + integration cards
// ─────────────────────────────────────────────────────────────

function ProviderSection({
  provider,
  integrations,
  connectedRepos,
  refetchIntegrations,
}: {
  connectedRepos: Repository[];
  integrations: OrganizationIntegration[];
  provider: IntegrationProvider;
  refetchIntegrations: () => void;
}) {
  // Use the first integration for the external settings link
  const firstIntegration = integrations[0];

  const openProviderSettingsModal = useCallback(() => {
    openModal(modalProps => (
      <ProviderSettingsModal
        {...modalProps}
        providerKey={provider.key}
        hasIntegration={integrations.length > 0}
      />
    ));
  }, [provider.key, integrations.length]);

  return (
    <Stack gap="md">
      {/* Provider title row */}
      <Flex align="center" justify="between">
        <Text bold size="lg">
          {provider.name}
        </Text>
        <Flex align="center" gap="sm">
          {firstIntegration && <ProviderConfigLink integration={firstIntegration} />}
          <Button
            size="xs"
            priority="transparent"
            icon={<IconSettings size="xs" />}
            onClick={openProviderSettingsModal}
            aria-label={t('%s settings', provider.name)}
          >
            {t('Settings')}
          </Button>
        </Flex>
      </Flex>

      {/* Integration cards */}
      <Stack gap="md">
        {integrations.map(integration => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            provider={provider}
            connectedRepos={connectedRepos.filter(
              r => r.integrationId === integration.id
            )}
            refetchIntegrations={refetchIntegrations}
          />
        ))}
      </Stack>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────
// Integration card
// ─────────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  provider,
  connectedRepos,
  refetchIntegrations,
}: {
  connectedRepos: Repository[];
  integration: OrganizationIntegration;
  provider: IntegrationProvider;
  refetchIntegrations: () => void;
}) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [repoSearchError, setRepoSearchError] = useState<number | null | undefined>(null);

  const canAccess =
    hasEveryAccess(['org:integrations'], {organization}) || isActiveSuperuser();

  const invalidateRepos = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [
        getApiUrl(`/organizations/$organizationIdOrSlug/repos/`, {
          path: {organizationIdOrSlug: organization.slug},
        }),
      ],
    });
  }, [queryClient, organization.slug]);

  const handleUninstall = useCallback(async () => {
    try {
      await api.requestPromise(
        `/organizations/${organization.slug}/integrations/${integration.id}/`,
        {method: 'DELETE'}
      );
      addSuccessMessage(t('%s has been disconnected', integration.name));
      refetchIntegrations();
    } catch {
      addErrorMessage(t('Failed to disconnect integration'));
    }
  }, [api, organization.slug, integration.id, integration.name, refetchIntegrations]);

  const confirmDisconnect = useCallback(() => {
    openConfirmModal({
      header: t('Disconnect %s', integration.name),
      message: t(
        'Are you sure you want to disconnect %s? This will remove all associated repositories and code mappings.',
        integration.name
      ),
      priority: 'danger',
      confirmText: t('Disconnect'),
      onConfirm: handleUninstall,
    });
  }, [integration.name, handleUninstall]);

  const handleRemoveRepo = useCallback(
    async (repo: Repository) => {
      try {
        await hideRepository(api, organization.slug, repo.id);
        addSuccessMessage(t('Removed %s', repo.name));
        invalidateRepos();
      } catch {
        addErrorMessage(t('Failed to remove repository'));
      }
    },
    [api, organization.slug, invalidateRepos]
  );

  const openSettingsModal = useCallback(() => {
    openModal(modalProps => (
      <IntegrationSettingsModal {...modalProps} integration={integration} />
    ));
  }, [integration]);

  return (
    <CardContainer>
      <CardHeader>
        <RowToggle onClick={() => setExpanded(!expanded)}>
          <IconChevron direction={expanded ? 'down' : 'right'} size="xs" />
          <RepoProviderIcon provider={`integrations:${provider.key}`} size="sm" />
          <Text bold>{integration.name}</Text>
          {integration.domainName && (
            <Text variant="muted" size="sm">
              {integration.domainName}
            </Text>
          )}
        </RowToggle>

        <Flex align="center" gap="sm">
          <Text size="sm" variant="muted">
            {t('%s repos connected', connectedRepos.length)}
          </Text>
          <IntegrationReposAddRepository
            integration={integration}
            currentRepositories={connectedRepos}
            onSearchError={setRepoSearchError}
            onAddRepository={() => invalidateRepos()}
          />
          <DropdownMenu
            trigger={triggerProps => (
              <Button
                size="xs"
                priority="transparent"
                aria-label={t('Actions')}
                icon={<IconEllipsis />}
                {...triggerProps}
              />
            )}
            position="bottom-end"
            items={[
              {
                key: 'settings',
                label: t('Settings'),
                onAction: openSettingsModal,
              },
              {
                key: 'disconnect',
                label: t('Disconnect'),
                priority: 'danger',
                disabled: !canAccess,
                onAction: confirmDisconnect,
              },
            ]}
          />
        </Flex>
      </CardHeader>

      {expanded && (
        <CardBody>
          {connectedRepos.map(repo => (
            <RepoRow
              key={repo.id}
              repo={repo}
              domainName={integration.domainName}
              canAccess={canAccess}
              onRemove={() => handleRemoveRepo(repo)}
            />
          ))}
          {repoSearchError === 400 && (
            <Flex padding="sm lg">
              <Text size="xs" variant="muted">
                {t('Unable to fetch repos. Try reconnecting.')}
              </Text>
            </Flex>
          )}
        </CardBody>
      )}
    </CardContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// Repo row
// ─────────────────────────────────────────────────────────────

function RepoRow({
  repo,
  domainName,
  canAccess,
  onRemove,
}: {
  canAccess: boolean;
  domainName: string | null;
  onRemove: () => void;
  repo: Repository;
}) {
  return (
    <RepoRowContainer>
      <Flex align="center" gap="xs" flex={1} overflow="hidden">
        {domainName ? (
          <ExternalLink href={`https://${domainName}/${repo.name}`}>
            <Flex align="center" gap="xs">
              {repo.name}
              <IconOpen size="xs" />
            </Flex>
          </ExternalLink>
        ) : (
          <Text size="sm">{repo.name}</Text>
        )}
      </Flex>
      <Confirm
        onConfirm={onRemove}
        message={t(
          'Are you sure you want to remove this repository? All associated commit data will be removed.'
        )}
        disabled={!canAccess}
      >
        <Button
          size="xs"
          priority="transparent"
          aria-label={t('Remove %s', repo.name)}
          icon={<IconSubtract />}
          disabled={!canAccess}
        />
      </Confirm>
    </RepoRowContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// Integration settings modal (per-integration config fields)
// ─────────────────────────────────────────────────────────────

function IntegrationSettingsModal({
  Header,
  Body,
  integration,
}: ModalRenderProps & {integration: OrganizationIntegration}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const endpoint = getApiUrl(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        integrationId: integration.id,
      },
    }
  );
  const settingsMutationOpts = mutationOptions({
    mutationFn: (formData: Record<string, unknown>) =>
      fetchMutation({method: 'POST', url: endpoint, data: formData}),
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: [
          getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
            path: {organizationIdOrSlug: organization.slug},
          }),
        ],
      });
    },
  });

  return (
    <Fragment>
      <Header closeButton>
        <h4>
          {integration.provider.name}: {integration.name}
        </h4>
      </Header>
      <Body>
        {integration.configOrganization.length > 0 ? (
          <Stack gap="lg">
            {integration.configOrganization.map(fieldConfig => (
              <BackendJsonFormAdapter
                key={fieldConfig.name}
                field={fieldConfig}
                initialValue={
                  integration.configData?.[fieldConfig.name] as FieldValue<
                    typeof fieldConfig
                  >
                }
                mutationOptions={settingsMutationOpts}
              />
            ))}
          </Stack>
        ) : (
          <Text variant="muted">
            {t('No configurable settings for this integration.')}
          </Text>
        )}
      </Body>
    </Fragment>
  );
}

// ─────────────────────────────────────────────────────────────
// Provider settings modal (org-level feature toggles)
// ─────────────────────────────────────────────────────────────

const githubFeaturesSchema = z.object({
  githubPRBot: z.boolean(),
  githubNudgeInvite: z.boolean(),
});

const gitlabFeaturesSchema = z.object({
  gitlabPRBot: z.boolean(),
});

function getOrgMutationOptions(organization: Organization) {
  const orgEndpoint = getApiUrl('/organizations/$organizationIdOrSlug/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  return mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({method: 'PUT', url: orgEndpoint, data}),
    onSuccess: data => updateOrganization(data),
  });
}

function ProviderSettingsModal({
  Header,
  Body,
  providerKey,
  hasIntegration,
}: ModalRenderProps & {hasIntegration: boolean; providerKey: string}) {
  const organization = useOrganization();
  const hasOrgWrite = organization.access.includes('org:write');
  const isDisabled = !hasOrgWrite || !hasIntegration;
  const orgMutationOptions = getOrgMutationOptions(organization);

  const renderFeatures = () => {
    switch (providerKey) {
      case 'github':
        return (
          <FieldGroup>
            <AutoSaveForm
              name="githubPRBot"
              schema={githubFeaturesSchema}
              initialValue={organization.githubPRBot}
              mutationOptions={orgMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('Enable Comments on Suspect Pull Requests')}
                  hintText={t(
                    'Allow Sentry to comment on recent pull requests suspected of causing issues.'
                  )}
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={isDisabled}
                    aria-label={t('Enable Comments on Suspect Pull Requests')}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveForm>
            <AutoSaveForm
              name="githubNudgeInvite"
              schema={githubFeaturesSchema}
              initialValue={organization.githubNudgeInvite}
              mutationOptions={orgMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('Enable Missing Member Detection')}
                  hintText={t(
                    'Allow Sentry to detect users committing to your GitHub repositories that are not part of your Sentry organization.'
                  )}
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={isDisabled}
                    aria-label={t('Enable Missing Member Detection')}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveForm>
          </FieldGroup>
        );
      case 'gitlab':
        return (
          <FieldGroup>
            <AutoSaveForm
              name="gitlabPRBot"
              schema={gitlabFeaturesSchema}
              initialValue={organization.gitlabPRBot}
              mutationOptions={orgMutationOptions}
            >
              {field => (
                <field.Layout.Row
                  label={t('Enable Comments on Suspect Pull Requests')}
                  hintText={t(
                    'Allow Sentry to comment on recent pull requests suspected of causing issues.'
                  )}
                >
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                    disabled={isDisabled}
                    aria-label={t('Enable Comments on Suspect Pull Requests')}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveForm>
          </FieldGroup>
        );
      default:
        return (
          <Text variant="muted">{t('No configurable settings for this provider.')}</Text>
        );
    }
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>
          {t(
            '%s Settings',
            providerKey === 'github'
              ? 'GitHub'
              : providerKey === 'gitlab'
                ? 'GitLab'
                : providerKey
          )}
        </h4>
      </Header>
      <Body>{renderFeatures()}</Body>
    </Fragment>
  );
}

// ─────────────────────────────────────────────────────────────
// Provider dropdown
// ─────────────────────────────────────────────────────────────

export function ProviderDropdown({
  providers,
  onAddIntegration,
  buttonText,
  size = 'sm',
  priority,
}: {
  buttonText: string;
  onAddIntegration: () => void;
  providers: IntegrationProvider[];
  priority?: 'primary' | 'default';
  size?: 'xs' | 'sm';
}) {
  const organization = useOrganization();
  const canAccess =
    hasEveryAccess(['org:integrations'], {organization}) || isActiveSuperuser();

  const singleProvider = providers.length === 1 ? providers[0] : undefined;
  if (singleProvider) {
    return (
      <AddIntegrationButton
        size={size}
        priority={priority}
        provider={singleProvider}
        organization={organization}
        onAddIntegration={onAddIntegration}
        disabled={!canAccess || !singleProvider.canAdd}
        buttonText={buttonText}
      />
    );
  }

  // Render a hidden AddIntegration for each provider so we can grab their openDialog refs.
  // When a user picks from the dropdown, we immediately trigger the OAuth flow.
  const dialogRefs: Record<string, (() => void) | undefined> = {};

  return (
    <Fragment>
      {/* Hidden AddIntegration instances to capture openDialog callbacks */}
      {providers.map(p => (
        <AddIntegration
          key={p.key}
          provider={p}
          organization={organization}
          onInstall={() => onAddIntegration()}
        >
          {openDialog => {
            dialogRefs[p.key] = openDialog;
            return null;
          }}
        </AddIntegration>
      ))}
      <DropdownMenu
        trigger={triggerProps => (
          <Button {...triggerProps} size={size} priority={priority} disabled={!canAccess}>
            {buttonText}
          </Button>
        )}
        position="bottom-end"
        items={providers.map(p => ({
          key: p.key,
          label: p.name,
          leadingItems: <RepoProviderIcon provider={`integrations:${p.key}`} size="xs" />,
          disabled: !p.canAdd,
          onAction: () => dialogRefs[p.key]?.(),
        }))}
      />
    </Fragment>
  );
}

// ─────────────────────────────────────────────────────────────
// Styled components
// ─────────────────────────────────────────────────────────────

const DashedContainer = styled('div')`
  border: 2px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space['3xl']} ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${p => p.theme.space.xl};
`;

const CardContainer = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const CardHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.tokens.background.secondary};
`;

const CardBody = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

const RowToggle = styled('button')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
`;

const RepoRowContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.tokens.border.neutral.muted};
  gap: ${p => p.theme.space.md};

  &:last-child {
    border-bottom: none;
  }
`;
