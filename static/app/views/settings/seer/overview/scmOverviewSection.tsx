import {Fragment, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
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
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {RepoProviderIcon} from 'sentry/components/repositories/repoProviderIcon';
import {getProviderConfigUrl} from 'sentry/components/repositories/scmIntegrationTree/providerConfigLink';
import {useScmIntegrationTreeData} from 'sentry/components/repositories/scmIntegrationTree/useScmIntegrationTreeData';
import {ScmRepoTreeModal} from 'sentry/components/repositories/scmRepoTreeModal';
import {IconAdd, IconOpen, IconSettings} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {
  IntegrationRepository,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SeerOverview} from 'sentry/views/settings/seer/overview/components';

interface Props {
  canWrite: boolean;
}

export function SCMOverviewSection({canWrite}: Props) {
  const organization = useOrganization();
  const {
    scmIntegrations,
    connectedIdentifiers,
    refetchIntegrations,
    reposByIntegrationId,
    reposPendingByIntegrationId,
    isPending,
    isError,
  } = useScmIntegrationTreeData();

  const supportedScmIntegrations = useMemo(
    () =>
      scmIntegrations.filter(i =>
        isSupportedAutofixProvider({id: i.provider.key, name: i.provider.name})
      ),
    [scmIntegrations]
  );

  const isReposPending = Object.values(reposPendingByIntegrationId).some(Boolean);
  const seerRepos = useMemo(() => {
    return Object.entries(reposByIntegrationId ?? {})
      .filter(([integrationId, _]) => {
        return supportedScmIntegrations.some(i => i.id === integrationId);
      })
      .flatMap(([_, repos]) => repos);
  }, [reposByIntegrationId, supportedScmIntegrations]);

  const connectedRepos = useMemo(() => {
    return seerRepos.filter(repo => connectedIdentifiers.has(repo.identifier));
  }, [connectedIdentifiers, seerRepos]);

  const unconnectedRepos = useMemo(() => {
    return supportedScmIntegrations.flatMap(integration => {
      const repos = reposByIntegrationId[integration.id] ?? [];
      return repos
        .filter(repo => !connectedIdentifiers.has(repo.identifier))
        .map(repo => ({repo, integration}));
    });
  }, [supportedScmIntegrations, reposByIntegrationId, connectedIdentifiers]);

  const stat = (
    <SeerOverview.Stat
      label={tn('Repository Connected', 'Repositories Connected', connectedRepos.length)}
      value={SeerOverview.formatStatValue(
        connectedRepos.length,
        seerRepos.length,
        isPending
      )}
      isPending={isReposPending}
    />
  );

  return (
    <SeerOverview.Section>
      <SeerOverview.SectionHeader title={t('Source Code Management')}>
        {isPending ? null : (
          <Link to={`/settings/${organization.slug}/seer/scm/`}>
            <Flex align="center" gap="xs">
              {t('Configure')} <IconSettings size="xs" />
            </Flex>
          </Link>
        )}
      </SeerOverview.SectionHeader>
      {isPending ? (
        stat
      ) : isError ? (
        <Fragment>
          {stat}
          <Flex align="center" justify="center">
            <LoadingError
              message={t('Error loading repositories')}
              onRetry={refetchIntegrations}
            />
          </Flex>
        </Fragment>
      ) : supportedScmIntegrations.length === 0 ? (
        <Stack
          column="1 / -1"
          align="center"
          justify="center"
          justifySelf="center"
          gap="lg"
          maxWidth="360px"
        >
          <InstallIntegrationButton onClose={refetchIntegrations} />
          <Text size="sm" variant="secondary" align="center">
            {t(
              'In order for Seer to work you must make sure at least one integration (Github, Gitlab etc) and at least one repo are connected to Sentry.'
            )}
          </Text>
        </Stack>
      ) : (
        <Fragment>
          {stat}
          {seerRepos.length === 0 ? (
            <CreateReposButton seerIntegrations={supportedScmIntegrations} />
          ) : (
            <ConnectAllReposButton
              disabled={!canWrite || connectedRepos.length === seerRepos.length}
              unconnectedRepos={unconnectedRepos}
              onDone={() => {
                refetchIntegrations();
              }}
            />
          )}
        </Fragment>
      )}
    </SeerOverview.Section>
  );
}

function InstallIntegrationButton({onClose}: {onClose: () => void}) {
  return (
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
            onClose,
          }
        );
      }}
    >
      {t('Install an Integration')}
    </Button>
  );
}

function CreateReposButton({
  seerIntegrations,
}: {
  seerIntegrations: OrganizationIntegration[];
}) {
  // no repos? link to github
  const externalLinks = seerIntegrations
    .map(integration => getProviderConfigUrl(integration))
    .filter(defined);
  if (externalLinks.length === 0) {
    return (
      <Text size="sm" variant="muted">
        {t('Configure your provider to allow Sentry to see your repos.')}
      </Text>
    );
  }
  return (
    <Stack gap="lg">
      <Text size="sm" variant="muted">
        {t('Allow Access so Sentry can see your repos.')}
      </Text>
      <ul>
        {seerIntegrations.map(integration => {
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
      </ul>
    </Stack>
  );
}

function ConnectAllReposButton({
  disabled,
  unconnectedRepos,
  onDone,
}: {
  disabled: boolean;
  onDone: () => void;
  unconnectedRepos: Array<{
    integration: OrganizationIntegration;
    repo: IntegrationRepository;
  }>;
}) {
  const organization = useOrganization();
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
          path: {organizationIdOrSlug: organization.slug},
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
    <Flex alignSelf="end">
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
