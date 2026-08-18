import {Fragment, useEffect, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import customIngestDomainBanner from 'sentry-images/spot/seer-config-connect-1.svg';

import {Alert, type AlertProps} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {PageBanner} from 'sentry/components/alerts/pageBanner';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconFlag, IconGlobe} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {ProjectKey} from 'sentry/types/project';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {
  managedIngestDomainApiOptions,
  MANAGED_INGEST_DOMAIN_POLL_INTERVAL,
  shouldPollManagedIngestDomain,
  type ManagedIngestDomainStatus,
} from 'sentry/utils/managedIngestDomain';
import {projectKeysApiOptions} from 'sentry/utils/projectKeys';
import {decodeScalar} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {usePrevious} from 'sentry/utils/usePrevious';
import {useRoutes} from 'sentry/utils/useRoutes';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {RelayDsnOverrideAlert} from 'sentry/views/settings/project/projectKeys/relayDsnOverrideAlert';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {KeyRow} from './keyRow';

export default function ProjectKeys() {
  const params = useParams<{projectId: string}>();
  const location = useLocation();
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const routes = useRoutes();

  const [keyListState, setKeyListState] = useState<ProjectKey[] | undefined>(undefined);

  const managedDomainQuery = useQuery({
    ...managedIngestDomainApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
    }),
    refetchInterval: query => {
      const status = query.state.data?.json.domain?.status;
      return shouldPollManagedIngestDomain(status)
        ? MANAGED_INGEST_DOMAIN_POLL_INTERVAL
        : false;
    },
  });
  const managedDomain = managedDomainQuery.data?.domain;
  const managedDomainStatus = managedDomain?.status;
  const previousManagedDomainStatus = usePrevious(managedDomainStatus);

  const projectKeysQueryOptions = projectKeysApiOptions({
    orgSlug: organization.slug,
    projSlug: project.slug,
    query: {
      cursor: decodeScalar(location.query.cursor),
      per_page: 5,
    },
  });
  const {
    data: keyListResponse,
    isPending,
    isError,
    refetch,
  } = useQuery({
    ...projectKeysQueryOptions,
    select: selectJsonWithHeaders,
    refetchInterval: shouldPollManagedIngestDomain(managedDomainStatus)
      ? MANAGED_INGEST_DOMAIN_POLL_INTERVAL
      : false,
  });

  useEffect(() => {
    if (previousManagedDomainStatus === managedDomainStatus) {
      return;
    }

    if (
      previousManagedDomainStatus === 'active' ||
      managedDomainStatus === 'active' ||
      managedDomain === null
    ) {
      void queryClient.invalidateQueries({queryKey: projectKeysQueryOptions.queryKey});
    }
  }, [
    managedDomain,
    managedDomainStatus,
    previousManagedDomainStatus,
    projectKeysQueryOptions.queryKey,
    queryClient,
  ]);

  /**
   * Optimistically remove key
   */
  const handleRemoveKeyMutation = useMutation({
    mutationFn: (data: ProjectKey) => {
      return api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/keys/${data.id}/`,
        {
          method: 'DELETE',
        }
      );
    },
    onMutate: (data: ProjectKey) => {
      addLoadingMessage(t('Revoking key\u2026'));
      setKeyListState(keyList.filter(key => key.id !== data.id));
    },
    onSuccess: () => {
      addSuccessMessage(t('Revoked key'));
    },
    onError: () => {
      setKeyListState([...keyList]);
      addErrorMessage(t('Unable to revoke key'));
    },
  });

  const handleToggleKeyMutation = useMutation({
    mutationFn: ({isActive, data}: {data: ProjectKey; isActive: boolean}) => {
      return api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/keys/${data.id}/`,
        {
          method: 'PUT',
          data: {isActive},
        }
      );
    },
    onMutate: ({data}) => {
      addLoadingMessage(t('Saving changes\u2026'));
      setKeyListState(
        keyList.map(key => {
          if (key.id === data.id) {
            return {
              ...key,
              isActive: !data.isActive,
            };
          }

          return key;
        })
      );
    },
    onSuccess: ({isActive}: {isActive: boolean}) => {
      addSuccessMessage(isActive ? t('Enabled key') : t('Disabled key'));
    },
    onError: ({isActive}: {isActive: boolean}) => {
      addErrorMessage(isActive ? t('Error enabling key') : t('Error disabling key'));
      setKeyListState([...keyList]);
    },
  });

  const handleCreateKeyMutation = useMutation({
    mutationFn: () => {
      return api.requestPromise(`/projects/${organization.slug}/${project.slug}/keys/`, {
        method: 'POST',
      });
    },
    onSuccess: (updatedKey: ProjectKey) => {
      setKeyListState([...keyList, updatedKey]);
      addSuccessMessage(t('Created a new key.'));
    },
    onError: () => {
      addErrorMessage(t('Unable to create new key. Please try again.'));
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const keyList = keyListState ? keyListState : keyListResponse.json;

  const renderEmpty = () => {
    return (
      <Panel>
        <EmptyMessage icon={<IconFlag />}>
          {t('There are no keys active for this project.')}
        </EmptyMessage>
      </Panel>
    );
  };

  const renderResults = () => {
    const hasAccess = hasEveryAccess(['project:write'], {organization, project});

    return (
      <Fragment>
        {keyList.map(key => (
          <KeyRow
            hasWriteAccess={hasAccess}
            key={key.id}
            projectId={project.slug}
            project={project}
            data={key}
            onToggle={(isActive, data) =>
              handleToggleKeyMutation.mutate({isActive, data})
            }
            onRemove={data => handleRemoveKeyMutation.mutate(data)}
            routes={routes}
            location={location}
            params={params}
          />
        ))}
        <Pagination pageLinks={keyListResponse.headers.Link} />
      </Fragment>
    );
  };

  const isEmpty = !keyList.length;
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});
  const customIngestDomainUrl = `/settings/${organization.slug}/projects/${project.slug}/custom-ingest-domain/`;
  const managedDomainNotice = managedDomain
    ? (
        {
          creating: {
            action: t('Continue Setup'),
            description: t('Sentry is registering %s.', managedDomain.hostname),
            heading: t('Your new front door is on the way.'),
            variant: 'info',
          },
          pending_dns: {
            action: t('Continue Setup'),
            description: t(
              'Finish the DNS setup for %s to keep things moving.',
              managedDomain.hostname
            ),
            heading: t('Your new front door is almost open.'),
            variant: 'warning',
          },
          pending_certificate: {
            action: t('Continue Setup'),
            description: t(
              'DNS is ready. Sentry is issuing a TLS certificate for %s.',
              managedDomain.hostname
            ),
            heading: t('DNS is done. The lock is next.'),
            variant: 'info',
          },
          active: {
            action: t('Manage'),
            description: t(
              '%s is live. The custom DSNs below send SDK events through it.',
              managedDomain.hostname
            ),
            heading: t('Your errors have a new front door.'),
            variant: 'success',
          },
          error: {
            action: t('Fix Setup'),
            description: t(
              '%s needs attention before it can receive SDK events.',
              managedDomain.hostname
            ),
            heading: t('Your custom domain hit a snag.'),
            variant: 'danger',
          },
          deleting: {
            action: t('View Status'),
            description: t(
              'Sentry is removing %s. The standard DSNs below remain available.',
              managedDomain.hostname
            ),
            heading: t('Back to the standard route.'),
            variant: 'muted',
          },
        } satisfies Record<
          ManagedIngestDomainStatus,
          {
            action: string;
            description: string;
            heading: string;
            variant: AlertProps['variant'];
          }
        >
      )[managedDomain.status]
    : null;

  return (
    <div data-test-id="project-keys">
      <SentryDocumentTitle title={t('Client Keys')} projectSlug={project.slug} />
      <SettingsPageHeader
        title={t('Client Keys')}
        action={
          <Button
            onClick={() => handleCreateKeyMutation.mutate()}
            size="md"
            variant="primary"
            icon={<IconAdd />}
            disabled={!hasAccess}
          >
            {t('Generate New Key')}
          </Button>
        }
        subtitle={tct(
          `To send data to Sentry you will need to configure an SDK with a client key
          (usually referred to as the [code:SENTRY_DSN] value). For more
          information on integrating Sentry with your application take a look at our
          [link:documentation].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/configuration/options/" />
            ),
            code: <code />,
          }
        )}
      />

      <ProjectPermissionAlert project={project} />
      <RelayDsnOverrideAlert />

      {managedDomain === null ? (
        <Container paddingBottom="xl">
          <PageBanner
            title={t('Custom Ingest Domain')}
            heading={t("Don't let blockers eat your errors")}
            description={t(
              "Route SDK telemetry through your own domain so ad blockers and network filters are less likely to swallow events. Swap in the new DSN. That's the whole migration."
            )}
            hideImageOnSmallScreens
            icon={<IconGlobe size="sm" variant="accent" />}
            image={customIngestDomainBanner}
            imageFit="contain"
            imagePosition="left center"
            button={
              <LinkButton variant="primary" to={customIngestDomainUrl}>
                {t('Set Up Custom Domain')}
              </LinkButton>
            }
          />
        </Container>
      ) : managedDomainNotice ? (
        <Container paddingBottom="xl">
          <Alert
            variant={managedDomainNotice.variant}
            trailingItems={
              <LinkButton size="sm" to={customIngestDomainUrl}>
                {managedDomainNotice.action}
              </LinkButton>
            }
          >
            <Stack gap="xs">
              <Text bold>{managedDomainNotice.heading}</Text>
              <Text size="sm">{managedDomainNotice.description}</Text>
            </Stack>
          </Alert>
        </Container>
      ) : null}

      {isEmpty ? renderEmpty() : renderResults()}
    </div>
  );
}
