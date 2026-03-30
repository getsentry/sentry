import {useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {
  isSeerSupportedProvider,
  useSeerSupportedProviderIds,
} from 'sentry/components/events/autofix/utils';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {getProviderConfigUrl} from 'sentry/components/repositories/scmIntegrationTree/providerConfigLink';
import {useScmIntegrationTreeData} from 'sentry/components/repositories/scmIntegrationTree/useScmIntegrationTreeData';
import {ScmRepoTreeModal} from 'sentry/components/repositories/scmRepoTreeModal';
import {IconAdd, IconOpen, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  IntegrationRepository,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

interface SCMOverviewSectionData {
  connectedRepos: IntegrationRepository[];
  isError: boolean;
  isPending: boolean;
  isReposPending: boolean;
  refetchIntegrations: () => void;
  seerRepos: IntegrationRepository[];
  supportedScmIntegrations: OrganizationIntegration[];
  unconnectedRepos: Array<{
    integration: OrganizationIntegration;
    repo: IntegrationRepository;
  }>;
}

export function useSCMOverviewSection(): SCMOverviewSectionData {
  const {
    scmIntegrations,
    connectedIdentifiers,
    refetchIntegrations,
    reposByIntegrationId,
    reposPendingByIntegrationId,
    isPending,
    isError,
  } = useScmIntegrationTreeData();
  const supportedProviderIds = useSeerSupportedProviderIds();

  const supportedScmIntegrations = useMemo(
    () =>
      scmIntegrations.filter(i =>
        isSeerSupportedProvider(
          {id: i.provider.key, name: i.provider.name},
          supportedProviderIds
        )
      ),
    [scmIntegrations, supportedProviderIds]
  );

  const isReposPending = Object.values(reposPendingByIntegrationId).some(Boolean);

  const seerRepos = useMemo(() => {
    return Object.entries(reposByIntegrationId ?? {})
      .filter(([integrationId]) =>
        supportedScmIntegrations.some(i => i.id === integrationId)
      )
      .flatMap(([_, repos]) => repos);
  }, [reposByIntegrationId, supportedScmIntegrations]);

  const connectedRepos = useMemo(
    () => seerRepos.filter(repo => connectedIdentifiers.has(repo.identifier)),
    [connectedIdentifiers, seerRepos]
  );

  const unconnectedRepos = useMemo(
    () =>
      supportedScmIntegrations.flatMap(integration => {
        const repos = reposByIntegrationId[integration.id] ?? [];
        return repos
          .filter(repo => !connectedIdentifiers.has(repo.identifier))
          .map(repo => ({repo, integration}));
      }),
    [supportedScmIntegrations, reposByIntegrationId, connectedIdentifiers]
  );

  return {
    isPending,
    isError,
    isReposPending,
    supportedScmIntegrations,
    seerRepos,
    connectedRepos,
    unconnectedRepos,
    refetchIntegrations,
  };
}

interface Props extends SCMOverviewSectionData {
  canWrite: boolean;
  organizationSlug: string;
}

export function SCMOverviewSection(props: Props) {
  const {
    isError,
    isPending,
    organizationSlug,
    refetchIntegrations,
    seerRepos,
    supportedScmIntegrations,
  } = props;
  return (
    <FieldGroup
      title={
        <Flex justify="between" gap="md" flexGrow={1}>
          <span>{t('Repositories')}</span>
          <Text uppercase={false}>
            <Link to={`/settings/${organizationSlug}/seer/scm/`}>
              <Flex align="center" gap="xs">
                {t('Configure')} <IconSettings size="xs" />
              </Flex>
            </Link>
          </Text>
        </Flex>
      }
    >
      {isPending ? (
        <Flex align="center" gap="md">
          <LoadingIndicator size={16} style={{margin: '0'}} />
          <Text size="sm" variant="muted">
            {t('Loading source code providers and repositories...')}
          </Text>
        </Flex>
      ) : isError ? (
        <AlertRoundBottom
          system
          variant="danger"
          data-test-id="loading-error"
          trailingItems={
            <Alert.Button onClick={refetchIntegrations} priority="default">
              {t('Retry')}
            </Alert.Button>
          }
        >
          {t('Error loading repositories')}
        </AlertRoundBottom>
      ) : supportedScmIntegrations.length === 0 ? (
        <NoIntegrations {...props} />
      ) : seerRepos.length === 0 ? (
        <NoRepos {...props} />
      ) : (
        <AddedRepos {...props} />
      )}
    </FieldGroup>
  );
}

function NoIntegrations({refetchIntegrations}: {refetchIntegrations: () => void}) {
  return (
    <Stack align="center" justifySelf="center" gap="lg" maxWidth="360px">
      <Button
        priority="primary"
        size="sm"
        icon={<IconAdd />}
        onClick={() => {
          openModal(
            deps => <ScmRepoTreeModal {...deps} title={t('Install Integration')} />,
            {
              modalCss: css`
                width: 700px;
              `,
              onClose: refetchIntegrations,
            }
          );
        }}
      >
        {t('Install an Integration')}
      </Button>
      <Text size="sm" variant="secondary" align="center">
        {t(
          'In order for Seer to work you must make sure at least one integration and at least one repo added to Sentry.'
        )}
      </Text>
    </Stack>
  );
}

function NoRepos({supportedScmIntegrations}: Props) {
  const externalLinks = supportedScmIntegrations
    .map(integration => getProviderConfigUrl(integration))
    .filter(defined);

  return (
    <Flex align="center" gap="lg">
      <Stack width="50%" gap="xs">
        <Text>{t('0 Repositories Added')}</Text>
        <Text size="sm" variant="muted">
          {externalLinks.length === 0
            ? t('Configure your provider to allow Sentry to see your repos.')
            : t('Allow Access so Sentry can see your repos.')}
        </Text>
      </Stack>
      <Flex>
        <List>
          {supportedScmIntegrations.map(integration => {
            const href = getProviderConfigUrl(integration);
            if (!href) {
              return null;
            }
            return (
              <li key={integration.id}>
                <Tooltip title={t('External installation settings')} skipWrapper>
                  <ExternalLink href={href} onClick={e => e.stopPropagation()}>
                    <Flex align="center" gap="sm">
                      <RepoProviderIcon provider={integration.provider.key} size="xs" />
                      {integration.domainName ?? integration.provider.name}
                      <IconOpen size="xs" />
                    </Flex>
                  </ExternalLink>
                </Tooltip>
              </li>
            );
          })}
        </List>
      </Flex>
    </Flex>
  );
}

function AddedRepos({
  canWrite,
  connectedRepos,
  isReposPending,
  organizationSlug,
  refetchIntegrations,
  seerRepos,
  unconnectedRepos,
}: Props) {
  return (
    <Flex align="center" gap="lg">
      <Stack width="50%" gap="xs">
        <Flex align="center" gap="sm">
          {isReposPending ? <LoadingIndicator size={16} style={{margin: '0'}} /> : null}
          {seerRepos.length === 1
            ? t('1 Repository Added')
            : t('%s of %s Repositories Added', connectedRepos.length, seerRepos.length)}
        </Flex>

        <Text size="sm" variant="muted">
          {t('Repositories shared with Sentry must be added before they can use used.')}
        </Text>
      </Stack>
      <AddAllReposButton
        organizationSlug={organizationSlug}
        disabled={!canWrite || connectedRepos.length === seerRepos.length}
        unconnectedRepos={unconnectedRepos}
        onDone={refetchIntegrations}
      />
    </Flex>
  );
}

function AddAllReposButton({
  organizationSlug,
  disabled,
  unconnectedRepos,
  onDone,
}: {
  disabled: boolean;
  onDone: () => void;
  organizationSlug: string;
  unconnectedRepos: Array<{
    integration: OrganizationIntegration;
    repo: IntegrationRepository;
  }>;
}) {
  const [isBusy, setIsBusy] = useState(false);

  const {mutateAsync} = useMutation({
    mutationFn: ({
      repo,
      integration,
    }: {
      integration: OrganizationIntegration;
      repo: IntegrationRepository;
    }) =>
      fetchMutation({
        method: 'POST',
        url: getApiUrl('/organizations/$organizationIdOrSlug/repos/', {
          path: {organizationIdOrSlug: organizationSlug},
        }),
        data: {
          installation: integration.id,
          identifier: repo.identifier,
          provider: `integrations:${integration.provider.key}`,
        },
      }),
  });

  async function handleClick() {
    setIsBusy(true);
    addLoadingMessage(t('Connecting repositories\u2026'));
    try {
      const results = await Promise.allSettled(
        unconnectedRepos.map(({repo, integration}) => mutateAsync({repo, integration}))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      if (failed === 0) {
        addSuccessMessage(t('All repositories connected'));
      } else if (succeeded === 0) {
        addErrorMessage(t('Failed to connect repositories'));
      } else {
        addErrorMessage(t('%s repositories connected, %s failed', succeeded, failed));
      }
    } finally {
      setIsBusy(false);
      onDone();
    }
  }

  return (
    <Flex align="center">
      <Button
        priority="primary"
        size="xs"
        icon={<IconAdd />}
        disabled={disabled}
        busy={isBusy}
        onClick={handleClick}
      >
        {t('Add all repos')}
      </Button>
    </Flex>
  );
}

const AlertRoundBottom = styled(Alert)`
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  overflow: hidden;
`;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;
