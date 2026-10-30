import {Fragment, useEffect, useRef, useState} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {IconArrow} from '@sentry/icons/arrow';
import {IconDelete} from '@sentry/icons/delete';
import {IconOpen} from '@sentry/icons/open';
import {IconVercel} from '@sentry/icons/vercel';
import * as Sentry from '@sentry/react';
import {useMutation, type UseMutationOptions} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {useFormErrorMapper} from '@sentry/scraps/form/formErrorContext';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Confirm} from 'sentry/components/confirm';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {IdBadge} from 'sentry/components/idBadge';
import {LoadingError} from 'sentry/components/loadingError';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import {oxfordizeArray} from 'sentry/utils/oxfordizeArray';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

type ProjectMapping = [sentryProjectId: number, vercelProjectId: string];

type SaveMutationOptions = UseMutationOptions<
  unknown,
  Error,
  {project_mappings: ProjectMapping[]}
>;

const projectMappingsSchema = z.array(z.tuple([z.number(), z.string()]));

const projectMappingsFieldSchema = z.object({
  mappedDropdown: z.object({
    items: z.array(
      z.object({label: z.string(), value: z.string(), url: z.string().optional()})
    ),
  }),
  sentryProjects: z.array(
    z.object({
      id: z.number(),
      slug: z.string(),
      platform: z
        .custom<PlatformKey>(value => typeof value === 'string')
        .nullish()
        .transform(platform => platform ?? undefined),
    })
  ),
});

type ProjectMappingsField = z.infer<typeof projectMappingsFieldSchema>;
type VercelProject = ProjectMappingsField['mappedDropdown']['items'][number];

const existingEnvVarsSchema = z.object({
  existing_env_vars: z.array(z.object({key: z.string(), target: z.array(z.string())})),
});

type SaveError = {
  message: string;
  existingEnvVars?: z.infer<typeof existingEnvVarsSchema>['existing_env_vars'];
  vercelProject?: VercelProject;
};

const VERCEL_ENVIRONMENTS = ['production', 'preview', 'development'];

const CREATE_PROJECT = 'create-project';

const COLUMNS: TableColumnConfig[] = [
  {key: 'vercelProject', width: 'minmax(0, 1fr)'},
  {key: 'arrow', width: 'max-content'},
  {key: 'sentryProject', width: 'minmax(0, 1fr)'},
  {key: 'actions', width: 'max-content'},
];

function useSaveErrorMessage() {
  const mapFormError = useFormErrorMapper();

  return (error: Error) => {
    const fallbackMessage = t('Failed to save');
    const mappedError = mapFormError<{project_mappings: ProjectMapping[]}>(
      error,
      {project_mappings: []},
      fallbackMessage
    );
    if (mappedError && 'fieldErrors' in mappedError) {
      return mappedError.fieldErrors.project_mappings?.message ?? fallbackMessage;
    }
    return mappedError?.message ?? fallbackMessage;
  };
}

export function VercelIntegrationForm({
  integration,
  mutationOptions,
}: {
  integration: OrganizationIntegration;
  mutationOptions: SaveMutationOptions;
}) {
  const organization = useOrganization();
  const {openModal} = useModal();
  const getSaveErrorMessage = useSaveErrorMessage();
  const mutation = useMutation(mutationOptions);

  const field = projectMappingsFieldSchema.safeParse(
    integration.configOrganization?.find(
      configField => configField.name === 'project_mappings'
    )
  ).data;
  const mappings = projectMappingsSchema.safeParse(
    integration.configData?.project_mappings ?? []
  ).data;

  const latestMappings = useRef(mappings ?? []);
  useEffect(() => {
    latestMappings.current = mappings ?? [];
  }, [mappings]);

  if (!field || !mappings) {
    return (
      <LoadingError message={t("Sentry couldn't read the linked Vercel projects.")} />
    );
  }

  const vercelProjects = field.mappedDropdown.items;
  const sentryProjects = field.sentryProjects;
  const vercelProjectsById = new Map(
    vercelProjects.map(project => [project.value, project])
  );
  const sentryProjectsById = new Map(
    sentryProjects.map(project => [project.id, project])
  );
  const pendingVercelProjectIds = mutation.isPending
    ? new Set(mutation.variables.project_mappings.map(([, id]) => id))
    : undefined;

  const link = async ([sentryProjectId, vercelProjectId]: ProjectMapping) => {
    await mutation.mutateAsync({
      project_mappings: [
        ...latestMappings.current.filter(([, linkedId]) => linkedId !== vercelProjectId),
        [sentryProjectId, vercelProjectId],
      ],
    });
    const vercelProject = vercelProjectsById.get(vercelProjectId);
    if (vercelProject) {
      toast.success(t('Linked %s. Redeploy in Vercel to apply.', vercelProject.label));
    }
  };

  const handleUnlink = (vercelProjectId: string) => {
    mutation.mutate(
      {
        project_mappings: latestMappings.current.filter(
          ([, linkedId]) => linkedId !== vercelProjectId
        ),
      },
      {onError: error => toast.error(getSaveErrorMessage(error))}
    );
  };

  const openLinkModal = () => {
    openModal(modalProps => (
      <LinkProjectModal
        {...modalProps}
        organization={organization}
        mappings={mappings}
        vercelProjects={vercelProjects}
        sentryProjects={sentryProjects}
        onLink={link}
      />
    ));
  };

  return (
    <Stack gap="xl" paddingBottom="xl">
      <Text variant="muted">
        {t(
          'Link each Vercel project to the Sentry project it reports to. Sentry adds the environment variables your app needs to send errors and upload source maps. Redeploy in Vercel to apply them.'
        )}
      </Text>
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Vercel project')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell />
            <SimpleTable.HeaderCell>{t('Sentry project')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell align="right">
              <Button
                size="xs"
                icon={<IconAdd />}
                onClick={openLinkModal}
                disabled={mutation.isPending}
              >
                {t('Link Project')}
              </Button>
            </SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {mappings.length === 0 ? (
          <SimpleTable.Empty>
            <EmptyMessage
              icon={<IconVercel />}
              title={t('No linked projects')}
              action={
                <LinkButton
                  href="https://docs.sentry.io/organization/integrations/deployment/vercel/"
                  size="sm"
                  external
                >
                  {t('View Documentation')}
                </LinkButton>
              }
            >
              {t('Link a Vercel project to set up its Sentry environment variables.')}
            </EmptyMessage>
          </SimpleTable.Empty>
        ) : (
          mappings.map(([sentryProjectId, vercelProjectId]) => {
            const vercelProject = vercelProjectsById.get(vercelProjectId);
            const sentryProject = sentryProjectsById.get(sentryProjectId);

            return (
              <SimpleTable.Row key={vercelProjectId}>
                <SimpleTable.RowCell gap="md">
                  {vercelProject ? (
                    <Fragment>
                      <IconVercel />
                      <Container minWidth={0}>
                        <Text ellipsis>{vercelProject.label}</Text>
                      </Container>
                      {vercelProject.url && (
                        <LinkButton
                          size="zero"
                          variant="transparent"
                          icon={<IconOpen size="xs" />}
                          href={vercelProject.url}
                          external
                          aria-label={t('Open %s', vercelProject.label)}
                          tooltipProps={{title: t('Open in Vercel')}}
                        />
                      )}
                    </Fragment>
                  ) : (
                    <NotFound
                      title={t(
                        'This project was deleted or Sentry can no longer access it.'
                      )}
                    />
                  )}
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <IconArrow size="xs" direction="right" />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  {sentryProject ? (
                    <IdBadge
                      project={sentryProject}
                      avatarSize={16}
                      displayName={sentryProject.slug}
                      avatarProps={{consistentWidth: true}}
                    />
                  ) : (
                    <NotFound title={t('This Sentry project was deleted.')} />
                  )}
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Confirm
                    onConfirm={() => handleUnlink(vercelProjectId)}
                    header={
                      <Heading as="h4">
                        {vercelProject
                          ? t('Unlink %s?', vercelProject.label)
                          : t('Unlink this Vercel project?')}
                      </Heading>
                    }
                    message={
                      <Stack gap="md">
                        <Text>
                          {t(
                            'Sentry will stop creating a release when this project deploys to production. Releases and errors already in Sentry stay.'
                          )}
                        </Text>
                        <Text>
                          {t(
                            "The environment variables Sentry added in Vercel stay, so unlinking doesn't stop error reporting or source map uploads."
                          )}
                        </Text>
                      </Stack>
                    }
                    confirmText={t('Unlink')}
                    disabled={mutation.isPending}
                  >
                    <Button
                      icon={<IconDelete />}
                      size="sm"
                      variant="transparent"
                      busy={
                        pendingVercelProjectIds !== undefined &&
                        !pendingVercelProjectIds.has(vercelProjectId)
                      }
                      disabled={mutation.isPending}
                      aria-label={t('Unlink')}
                      tooltipProps={{title: t('Unlink')}}
                    />
                  </Confirm>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            );
          })
        )}
      </SimpleTable>
      <CompleteOnVercelButton
        hasLinkedProjects={mappings.length > 0}
        isSaving={mutation.isPending}
      />
    </Stack>
  );
}

function LinkProjectModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  mappings,
  vercelProjects,
  sentryProjects,
  onLink,
}: ModalRenderProps & {
  mappings: ProjectMapping[];
  onLink: (mapping: ProjectMapping) => Promise<unknown>;
  organization: Organization;
  sentryProjects: ProjectMappingsField['sentryProjects'];
  vercelProjects: ProjectMappingsField['mappedDropdown']['items'];
}) {
  const getSaveErrorMessage = useSaveErrorMessage();
  const [error, setError] = useState<SaveError | null>(null);

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {vercelProjectId: '', sentryProjectId: ''},
    onSubmit: ({value}) =>
      onLink([Number(value.sentryProjectId), value.vercelProjectId]).then(
        closeModal,
        (saveError: Error) =>
          setError({
            message: getSaveErrorMessage(saveError),
            existingEnvVars:
              saveError instanceof RequestError
                ? existingEnvVarsSchema.safeParse(saveError.responseJSON).data
                    ?.existing_env_vars
                : undefined,
            vercelProject: vercelProjects.find(
              project => project.value === value.vercelProjectId
            ),
          })
      ),
  });

  const linkedVercelProjectIds = new Set(mappings.map(([, id]) => id));
  const vercelProjectOptions = vercelProjects
    .filter(project => !linkedVercelProjectIds.has(project.value))
    .map(project => ({
      value: project.value,
      label: project.label,
      leadingItems: <IconVercel />,
    }));
  const sentryProjectOptions = [
    {value: CREATE_PROJECT, label: t('Create a Project'), leadingItems: <IconAdd />},
    ...sentryProjects.map(project => ({
      value: String(project.id),
      label: project.slug,
      leadingItems: (
        <IdBadge
          project={project}
          avatarSize={16}
          avatarProps={{consistentWidth: true}}
          disableLink
          hideName
        />
      ),
    })),
  ];

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">{t('Link Vercel Project')}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="vercelProjectId">
            {vercelField => (
              <vercelField.Layout.Stack label={t('Vercel project')} required>
                <vercelField.Select
                  value={vercelField.state.value}
                  onChange={vercelField.handleChange}
                  placeholder={t('Choose Vercel project')}
                  options={vercelProjectOptions}
                />
              </vercelField.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="sentryProjectId">
            {sentryField => (
              <sentryField.Layout.Stack label={t('Sentry project')} required>
                <sentryField.Select
                  value={sentryField.state.value}
                  onChange={value => {
                    if (value === CREATE_PROJECT) {
                      window.open(
                        makeProjectsPathname({path: '/new/', organization}),
                        '_blank',
                        'noopener,noreferrer'
                      );
                      return;
                    }
                    sentryField.handleChange(value);
                  }}
                  placeholder={t('Choose Sentry project')}
                  options={sentryProjectOptions}
                />
              </sentryField.Layout.Stack>
            )}
          </form.AppField>
          {error && <SaveErrorAlert {...error} />}
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.Subscribe
            selector={state =>
              state.values.vercelProjectId !== '' && state.values.sentryProjectId !== ''
            }
          >
            {hasSelection => (
              <form.SubmitButton disabled={!hasSelection}>
                {t('Link Project')}
              </form.SubmitButton>
            )}
          </form.Subscribe>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

function SaveErrorAlert({message, existingEnvVars, vercelProject}: SaveError) {
  const projectName = vercelProject?.label ?? t('this project');

  if (!existingEnvVars) {
    return (
      <Alert variant="danger" role="alert">
        <Stack gap="xs">
          <Text bold>{t("Couldn't link %s", projectName)}</Text>
          <Text>{message}</Text>
        </Stack>
      </Alert>
    );
  }

  return (
    <Alert variant="danger" role="alert">
      <Stack gap="lg">
        <Stack gap="xs">
          <Text bold>
            {t('Delete these variables in Vercel to link %s', projectName)}
          </Text>
          <Text>{t("Sentry can't overwrite the following variables:")}</Text>
        </Stack>
        <Grid columns="max-content 1fr max-content" gap="sm lg" align="center">
          {existingEnvVars.map(envVar => (
            <Fragment key={envVar.key}>
              <Text monospace>{envVar.key}</Text>
              <Text variant="muted">{formatEnvironments(envVar.target)}</Text>
              {vercelProject?.url ? (
                <LinkButton
                  size="xs"
                  icon={<IconOpen />}
                  href={`${vercelProject.url}/settings/environment-variables?q=${encodeURIComponent(envVar.key)}`}
                  external
                  aria-label={t('Find %s in Vercel', envVar.key)}
                >
                  {t('Find in Vercel')}
                </LinkButton>
              ) : (
                <span />
              )}
            </Fragment>
          ))}
        </Grid>
      </Stack>
    </Alert>
  );
}

function formatEnvironments(target: string[]) {
  if (VERCEL_ENVIRONMENTS.every(environment => target.includes(environment))) {
    return t('All environments');
  }
  return oxfordizeArray(target.map(capitalize));
}

function NotFound({title}: {title: string}) {
  return (
    <Flex align="center" gap="xs">
      <Text variant="muted">{t('Not found')}</Text>
      <InfoTip title={title} size="xs" />
    </Flex>
  );
}

function CompleteOnVercelButton({
  hasLinkedProjects,
  isSaving,
}: {
  hasLinkedProjects: boolean;
  isSaving: boolean;
}) {
  const [nextUrl] = useQueryState('next', parseAsString);

  if (!nextUrl) {
    return null;
  }

  if (URL.parse(nextUrl)?.origin !== 'https://vercel.com') {
    Sentry.captureMessage(`Got invalid next url: ${nextUrl}`);
    return null;
  }

  return (
    <Flex align="center" justify="between" gap="md">
      <Text>
        {t('Link your Sentry projects to complete your installation on Vercel')}
      </Text>
      <LinkButton
        size="sm"
        variant="primary"
        icon={<IconOpen />}
        disabled={!hasLinkedProjects || isSaving}
        href={nextUrl}
        tooltipProps={{
          title: t('Please link at least one project to continue.'),
          disabled: hasLinkedProjects,
        }}
      >
        {t('Complete on Vercel')}
      </LinkButton>
    </Flex>
  );
}
