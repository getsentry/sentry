import {useEffect, useState} from 'react';
import {skipToken, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {
  defaultFormOptions,
  FieldGroup,
  setFieldErrors,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {TimeSince} from 'sentry/components/timeSince';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  getManagedIngestDisplayDsn,
  managedIngestDomainApiOptions,
  MANAGED_INGEST_DOMAIN_ENDPOINT,
  MANAGED_INGEST_DOMAIN_POLL_INTERVAL,
  shouldPollManagedIngestDomain,
  type ManagedIngestDomain,
  type ManagedIngestDomainDiagnosticStatus,
  type ManagedIngestDomainResponse,
  type ManagedIngestDomainStatus,
} from 'sentry/utils/managedIngestDomain';
import {projectKeysApiOptions} from 'sentry/utils/projectKeys';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

type ManagedIngestDomainConnect = {
  provider: 'cloudflare';
  url: string;
};

const schema = z.object({
  hostname: z.string().trim().min(1, t('Hostname is required')),
});

const MANAGED_INGEST_DOMAIN_REFRESH_ENDPOINT =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/managed-ingest-domain/refresh/' as const;
const MANAGED_INGEST_DOMAIN_CONNECT_ENDPOINT =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/managed-ingest-domain/domain-connect/' as const;

const HOSTNAME_EXAMPLES = [
  'all-good-here',
  'business-as-usual',
  'carry-on',
  'looks-good-to-me',
  'move-along',
  'nice-try',
  'nothing-to-see-here',
  'probably-fine',
  'ship-it',
  'still-here',
  'this-is-fine',
  'totally-normal',
  'working-as-intended',
] as const;
const HOSTNAME_EXAMPLE = `${HOSTNAME_EXAMPLES[Math.floor(Math.random() * HOSTNAME_EXAMPLES.length)]!}.example.com`;

const DIAGNOSTIC_STATUS = {
  passed: {label: t('Passed'), variant: 'success'},
  failed: {label: t('Failed'), variant: 'danger'},
  waiting: {label: t('Waiting'), variant: 'warning'},
} satisfies Record<
  ManagedIngestDomainDiagnosticStatus,
  {label: string; variant: TagProps['variant']}
>;

export default function ProjectCustomIngestDomain() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const queryClient = useQueryClient();
  const [refreshBaseline, setRefreshBaseline] = useState<{
    lastCheckedAt: string | null;
  } | null>(null);
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const path = {
    organizationIdOrSlug: organization.slug,
    projectIdOrSlug: project.slug,
  };
  const endpoint = getApiUrl(MANAGED_INGEST_DOMAIN_ENDPOINT, {path});
  const refreshEndpoint = getApiUrl(MANAGED_INGEST_DOMAIN_REFRESH_ENDPOINT, {path});
  const domainQueryOptions = managedIngestDomainApiOptions({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  const domainQuery = useQuery({
    ...domainQueryOptions,
    refetchInterval: query => {
      const queryStatus = query.state.data?.json.domain?.status;
      return refreshBaseline !== null || shouldPollManagedIngestDomain(queryStatus)
        ? MANAGED_INGEST_DOMAIN_POLL_INTERVAL
        : false;
    },
  });
  const domain = domainQuery.data?.domain;
  const domainConnectQuery = useQuery({
    ...apiOptions.as<ManagedIngestDomainConnect>()(
      MANAGED_INGEST_DOMAIN_CONNECT_ENDPOINT,
      {
        path:
          domain?.status === 'pending_dns' &&
          domain.cnameTarget &&
          domain.dnsProvider === 'cloudflare'
            ? path
            : skipToken,
        staleTime: Infinity,
      }
    ),
    retry: false,
  });

  const projectKeysQuery = useQuery(
    projectKeysApiOptions({
      orgSlug: organization.slug,
      projSlug: domain?.status === 'active' ? project.slug : undefined,
    })
  );
  const projectKey = projectKeysQuery.data?.find(
    key => key.managedIngest?.domainId === domain?.id
  );

  const updateDomain = (nextDomain: ManagedIngestDomain | null) => {
    queryClient.setQueryData(domainQueryOptions.queryKey, {
      json: {domain: nextDomain},
      headers: {},
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      fetchMutation<ManagedIngestDomainResponse>({method: 'POST', url: endpoint, data}),
    onSuccess: response => {
      updateDomain(response.domain);
      addSuccessMessage(t('Custom ingest domain added.'));
    },
    onError: () => addErrorMessage(t('Unable to add the custom ingest domain.')),
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      fetchMutation<ManagedIngestDomainResponse>({method: 'POST', url: refreshEndpoint}),
    onMutate: () => {
      setRefreshBaseline({lastCheckedAt: domain?.lastCheckedAt ?? null});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: domainQueryOptions.queryKey});
    },
    onError: () => {
      setRefreshBaseline(null);
      addErrorMessage(t('Unable to refresh the domain.'));
    },
  });

  useEffect(() => {
    if (refreshBaseline === null || domain === undefined) {
      return;
    }
    if (domain === null) {
      setRefreshBaseline(null);
      return;
    }
    if (domain.lastCheckedAt === refreshBaseline.lastCheckedAt) {
      return;
    }

    setRefreshBaseline(null);
    addSuccessMessage(t('Domain status refreshed.'));
  }, [domain, refreshBaseline]);

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchMutation<ManagedIngestDomainResponse>({method: 'DELETE', url: endpoint}),
    onSuccess: response => {
      updateDomain(response.domain);
      addSuccessMessage(t('Custom ingest domain removal started.'));
    },
    onError: () => addErrorMessage(t('Unable to remove the custom ingest domain.')),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {hostname: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) =>
      createMutation.mutateAsync(value).catch((error: RequestError) => {
        setFieldErrors(formApi, error);
      }),
  });

  if (domainQuery.isPending) {
    return <LoadingIndicator />;
  }

  if (domainQuery.isError) {
    return <LoadingError onRetry={domainQuery.refetch} />;
  }

  const status = domain
    ? (
        {
          creating: {
            description: t('Sentry is registering this hostname.'),
            label: t('Creating'),
            variant: 'info',
          },
          pending_dns: {
            description: t('Add the CNAME record below, then wait for DNS to update.'),
            label: t('Waiting for DNS'),
            variant: 'warning',
          },
          pending_certificate: {
            description: t('DNS is ready and a TLS certificate is being issued.'),
            label: t('Issuing certificate'),
            variant: 'info',
          },
          active: {
            description: t('SDK telemetry can now use this hostname.'),
            label: t('Active'),
            variant: 'success',
          },
          error: {
            description: t('Sentry could not finish configuring this hostname.'),
            label: t('Needs attention'),
            variant: 'danger',
          },
          deleting: {
            description: t('Sentry is removing this hostname.'),
            label: t('Removing'),
            variant: 'muted',
          },
        } satisfies Record<
          ManagedIngestDomainStatus,
          {description: string; label: string; variant: TagProps['variant']}
        >
      )[domain.status]
    : null;

  return (
    <SentryDocumentTitle title={t('Custom Ingest Domain')} projectSlug={project.slug}>
      <SettingsPageHeader title={t('Custom Ingest Domain')} />
      <Stack gap="2xl">
        <Stack gap="sm">
          <Heading as="h1" size="xl">
            {t('Custom Ingest Domain')}
          </Heading>
          <Text variant="muted" textWrap="pretty">
            {t(
              'Send SDK telemetry through a domain you control. The Sentry web app and other services continue to use your normal Sentry URL.'
            )}
          </Text>
        </Stack>

        <ProjectPermissionAlert project={project} />

        {domain === null || domain === undefined ? (
          <form.AppForm form={form}>
            <form.FieldGroup title={t('Add a custom ingest domain')}>
              <form.AppField name="hostname">
                {field => (
                  <field.Layout.Row
                    label={t('Hostname')}
                    hintText={t(
                      'Pick an unused, neutral hostname, such as %s. Avoid filter bait like “sentry,” “tracking,” or “analytics.”',
                      HOSTNAME_EXAMPLE
                    )}
                    required
                  >
                    <field.Input
                      value={field.state.value}
                      onChange={field.handleChange}
                      placeholder={HOSTNAME_EXAMPLE}
                      disabled={!hasWriteAccess}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>
              <Flex justify="end" padding="md">
                <form.SubmitButton disabled={!hasWriteAccess}>
                  {t('Add Domain')}
                </form.SubmitButton>
              </Flex>
            </form.FieldGroup>
          </form.AppForm>
        ) : (
          <Stack gap="xl">
            <FieldGroup title={t('Custom domain')}>
              <Stack gap="lg">
                <Flex align="start" justify="between" gap="lg" wrap="wrap">
                  <Stack gap="sm">
                    <Flex align="center" gap="md" wrap="wrap">
                      <Text size="lg" bold>
                        {domain.hostname}
                      </Text>
                      {status && <Tag variant={status.variant}>{status.label}</Tag>}
                    </Flex>
                    {status && <Text variant="muted">{status.description}</Text>}
                  </Stack>

                  {(domain.diagnostics.ranAt || domain.status !== 'deleting') && (
                    <Stack align="end" gap="xs">
                      {domain.status !== 'deleting' && (
                        <Button
                          size="sm"
                          onClick={() => refreshMutation.mutate()}
                          busy={refreshMutation.isPending || refreshBaseline !== null}
                          disabled={!hasWriteAccess || refreshBaseline !== null}
                        >
                          {domain.status === 'active'
                            ? t('Check Status')
                            : t('Refresh Status')}
                        </Button>
                      )}
                      {domain.diagnostics.ranAt && (
                        <Text size="sm" variant="muted">
                          {t('Last checked')}{' '}
                          <TimeSince date={domain.diagnostics.ranAt} />
                        </Text>
                      )}
                    </Stack>
                  )}
                </Flex>

                {domain.lastError && <Alert variant="danger">{domain.lastError}</Alert>}

                {domain.cnameTarget &&
                  domain.status !== 'active' &&
                  domain.status !== 'deleting' && (
                    <Stack gap="lg">
                      <Stack.Separator />
                      <Stack gap="xs">
                        <Heading as="h2" size="sm">
                          {domain.status === 'pending_dns'
                            ? t('Add this CNAME record')
                            : t('DNS record')}
                        </Heading>
                        <Text variant="muted">
                          {t('Create this record with your DNS provider.')}
                        </Text>
                      </Stack>
                      <Grid
                        columns={{xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))'}}
                        gap="lg"
                      >
                        <Stack gap="sm">
                          <Text size="sm" variant="muted">
                            {t('Name')}
                          </Text>
                          <TextCopyInput aria-label={t('CNAME name')}>
                            {domain.hostname}
                          </TextCopyInput>
                        </Stack>
                        <Stack gap="sm">
                          <Text size="sm" variant="muted">
                            {t('Target')}
                          </Text>
                          <TextCopyInput aria-label={t('CNAME target')}>
                            {domain.cnameTarget}
                          </TextCopyInput>
                        </Stack>
                      </Grid>
                      {domainConnectQuery.data?.provider === 'cloudflare' && (
                        <Alert
                          variant="info"
                          trailingItems={
                            <LinkButton
                              external
                              size="sm"
                              href={domainConnectQuery.data.url}
                              icon={<IconOpen />}
                              disabled={!hasWriteAccess}
                            >
                              {t('Configure automatically')}
                            </LinkButton>
                          }
                        >
                          {t(
                            "Your DNS is managed by Cloudflare. It can add this CNAME record for you, and you'll review the change before it is applied."
                          )}
                        </Alert>
                      )}
                    </Stack>
                  )}

                <Stack.Separator />

                <Disclosure size="sm" defaultExpanded={domain.status !== 'active'}>
                  <Disclosure.Title>{t('Setup progress')}</Disclosure.Title>
                  <Disclosure.Content>
                    <Grid gap="lg">
                      {domain.diagnostics.checks.map(check => {
                        const diagnosticStatus = DIAGNOSTIC_STATUS[check.status];
                        return (
                          <Grid
                            key={check.slug}
                            columns="5rem minmax(0, 1fr)"
                            align="start"
                            gap="md"
                          >
                            <Flex justify="center">
                              <Tag
                                variant={diagnosticStatus.variant}
                                style={{justifyContent: 'center', width: '100%'}}
                              >
                                {diagnosticStatus.label}
                              </Tag>
                            </Flex>
                            <Stack gap="xs">
                              <Text bold>{check.label}</Text>
                              <Text variant="muted">{check.summary}</Text>
                              {check.status === 'failed' && check.expected && (
                                <Text size="sm" variant="muted">
                                  {t('Expected: %s', check.expected)}
                                </Text>
                              )}
                              {check.status === 'failed' && check.observed && (
                                <Text size="sm" variant="muted">
                                  {t('Observed provider status: %s', check.observed)}
                                </Text>
                              )}
                            </Stack>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Disclosure.Content>
                </Disclosure>

                <Stack.Separator />

                <Flex align="center" justify="between" gap="lg" wrap="wrap">
                  <Stack gap="xs">
                    <Text size="sm" bold>
                      {domain.status === 'deleting'
                        ? t('Domain removal is still in progress')
                        : t('Remove custom domain')}
                    </Text>
                    <Text size="sm" variant="muted">
                      {domain.status === 'deleting'
                        ? t('Retry removal if the process does not finish automatically.')
                        : t('SDKs must use the standard Sentry DSN after removal.')}
                    </Text>
                  </Stack>

                  {domain.status === 'deleting' ? (
                    <Button
                      size="sm"
                      onClick={() => deleteMutation.mutate()}
                      busy={deleteMutation.isPending}
                      disabled={!hasWriteAccess || deleteMutation.isPending}
                    >
                      {t('Retry Removal')}
                    </Button>
                  ) : (
                    <Confirm
                      priority="danger"
                      confirmText={t('Remove Domain')}
                      message={t(
                        'Remove this custom ingest domain? SDKs using it will stop sending events until you switch them back to the standard Sentry DSN.'
                      )}
                      onConfirm={async () => {
                        await deleteMutation.mutateAsync();
                      }}
                      disabled={!hasWriteAccess || deleteMutation.isPending}
                    >
                      <Button
                        size="sm"
                        variant="danger"
                        busy={deleteMutation.isPending}
                        disabled={!hasWriteAccess || deleteMutation.isPending}
                      >
                        {t('Remove Domain')}
                      </Button>
                    </Confirm>
                  )}
                </Flex>
              </Stack>
            </FieldGroup>

            {domain.status === 'active' && (
              <FieldGroup title={t('SDK configuration')}>
                {projectKeysQuery.isPending ? (
                  <LoadingIndicator mini />
                ) : projectKeysQuery.isError || !projectKey?.managedIngest ? (
                  <LoadingError onRetry={projectKeysQuery.refetch} />
                ) : (
                  <Stack gap="lg">
                    <Stack gap="sm">
                      <Text>
                        {t('Use this DSN in your SDK to send through the custom domain.')}
                      </Text>
                      <TextCopyInput aria-label={t('Custom ingest DSN')}>
                        {projectKey.managedIngest.dsn.public}
                      </TextCopyInput>
                    </Stack>
                    <Stack gap="sm">
                      <Text>
                        {t('To roll back, switch the SDK to the standard Sentry DSN.')}
                      </Text>
                      <TextCopyInput aria-label={t('Standard Sentry DSN')}>
                        {getManagedIngestDisplayDsn(
                          projectKey.dsn.public,
                          organization.id
                        )}
                      </TextCopyInput>
                    </Stack>
                  </Stack>
                )}
              </FieldGroup>
            )}
          </Stack>
        )}
      </Stack>
    </SentryDocumentTitle>
  );
}
