import {Fragment} from 'react';
import styled from '@emotion/styled';
import {
  skipToken,
  useMutation,
  useQuery,
  type UseMutationResult,
} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {IconCheckmark, IconNot} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {
  CodeOwner,
  CodeownersFile,
  Integration,
  RepositoryProjectPathConfig,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';

type Props = {
  organization: Organization;
  project: Project;
  onSave?: (data: CodeOwner) => void;
} & ModalRenderProps;

const schema = z.object({
  codeMappingId: z
    .string()
    .nullable()
    .refine(v => v !== null, t('Code mapping is required')),
});

type FormValues = z.input<typeof schema>;

export function AddCodeOwnerModal({
  organization,
  Header,
  Body,
  Footer,
  project,
  onSave,
  closeModal,
}: Props) {
  const {
    data: codeMappings,
    isPending: isCodeMappingsPending,
    isError: isCodeMappingsError,
  } = useQuery(
    apiOptions.as<RepositoryProjectPathConfig[]>()(
      '/organizations/$organizationIdOrSlug/code-mappings/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {project: project.id},
        staleTime: Infinity,
      }
    )
  );

  if (isCodeMappingsPending) {
    return <LoadingIndicator />;
  }
  if (isCodeMappingsError) {
    return <LoadingError />;
  }

  if (!codeMappings.length) {
    return (
      <Fragment>
        <Header closeButton>{t('Add Code Owner File')}</Header>
        <Body>
          <LinkCodeOwners organization={organization} />
        </Body>
      </Fragment>
    );
  }

  return (
    <ApplyCodeMappings
      Header={Header}
      Body={Body}
      Footer={Footer}
      closeModal={closeModal}
      codeMappings={codeMappings}
      organization={organization}
      project={project}
      onSave={onSave}
    />
  );
}

function ApplyCodeMappings({
  Header,
  Body,
  Footer,
  closeModal,
  codeMappings,
  organization,
  project,
  onSave,
}: {
  Body: ModalRenderProps['Body'];
  Footer: ModalRenderProps['Footer'];
  Header: ModalRenderProps['Header'];
  closeModal: ModalRenderProps['closeModal'];
  codeMappings: RepositoryProjectPathConfig[];
  onSave: ((data: CodeOwner) => void) | undefined;
  organization: Organization;
  project: Project;
}) {
  const defaultValues: FormValues = {codeMappingId: null};

  const mutation = useMutation<
    CodeOwner,
    RequestError,
    {codeMappingId: string; raw: string}
  >({
    mutationFn: payload =>
      fetchMutation({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.slug}/codeowners/`,
        options: {},
        data: payload,
      }),
    onError: err => {
      if (err.responseJSON && !('raw' in err.responseJSON)) {
        addErrorMessage(
          Object.values(err.responseJSON ?? {})
            .flat()
            .join(' ')
        );
      }
    },
    gcTime: 0,
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>{t('Add Code Owner File')}</Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="codeMappingId">
            {field => (
              <field.Layout.Stack label={t('Apply an existing code mapping')} required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={codeMappings.map(cm => ({
                    value: cm.id,
                    label: `Repo Name: ${cm.repoName}, Stack Trace Root: ${cm.stackRoot}, Source Code Root: ${cm.sourceRoot}`,
                  }))}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.Subscribe selector={state => state.values.codeMappingId}>
            {codeMappingId => (
              <CodeownersFileStatus
                codeMappingId={codeMappingId}
                codeMappings={codeMappings}
                organization={organization}
                mutationError={mutation.error}
                mutationIsError={mutation.isError}
              />
            )}
          </form.Subscribe>
        </Stack>
      </Body>
      <Footer>
        <form.Subscribe selector={state => state.values.codeMappingId}>
          {codeMappingId => (
            <AddFileButton
              codeMappingId={codeMappingId}
              codeMappings={codeMappings}
              organization={organization}
              mutation={mutation}
              onSave={onSave}
              closeModal={closeModal}
            />
          )}
        </form.Subscribe>
      </Footer>
    </form.AppForm>
  );
}

function useCodeownersFile(organization: Organization, codeMappingId: string | null) {
  return useQuery(
    apiOptions.as<CodeownersFile>()(
      '/organizations/$organizationIdOrSlug/code-mappings/$configId/codeowners/',
      {
        path: codeMappingId
          ? {organizationIdOrSlug: organization.slug, configId: codeMappingId}
          : skipToken,
        staleTime: Infinity,
      }
    )
  );
}

function CodeownersFileStatus({
  codeMappingId,
  codeMappings,
  organization,
  mutationError,
  mutationIsError,
}: {
  codeMappingId: string | null;
  codeMappings: RepositoryProjectPathConfig[];
  mutationError: RequestError | null;
  mutationIsError: boolean;
  organization: Organization;
}) {
  const {data: codeownersFile} = useCodeownersFile(organization, codeMappingId);

  return (
    <Fragment>
      {codeownersFile ? <SourceFile codeownersFile={codeownersFile} /> : <NoSourceFile />}
      {mutationIsError && mutationError?.responseJSON?.raw ? (
        <ErrorMessage
          baseUrl={`/settings/${organization.slug}/integrations/`}
          codeMappingId={codeMappingId}
          codeMappings={codeMappings}
          errorJSON={mutationError.responseJSON as {raw?: string}}
        />
      ) : null}
    </Fragment>
  );
}

function AddFileButton({
  codeMappingId,
  codeMappings,
  organization,
  mutation,
  onSave,
  closeModal,
}: {
  closeModal: ModalRenderProps['closeModal'];
  codeMappingId: string | null;
  codeMappings: RepositoryProjectPathConfig[];
  mutation: UseMutationResult<
    CodeOwner,
    RequestError,
    {codeMappingId: string; raw: string}
  >;
  onSave: ((data: CodeOwner) => void) | undefined;
  organization: Organization;
}) {
  const {data: codeownersFile} = useCodeownersFile(organization, codeMappingId);

  const addFile = () => {
    if (!codeownersFile || !codeMappingId) {
      return;
    }
    mutation.mutate(
      {codeMappingId, raw: codeownersFile.raw},
      {
        onSuccess: data => {
          const codeMapping = codeMappings.find(mapping => mapping.id === codeMappingId);
          onSave?.({...data, codeMapping});
          closeModal();
        },
      }
    );
  };

  return (
    <Button
      disabled={!codeownersFile}
      aria-label={t('Add File')}
      variant="primary"
      onClick={addFile}
    >
      {t('Add File')}
    </Button>
  );
}

function LinkCodeOwners({organization}: {organization: Organization}) {
  const baseUrl = `/settings/${organization.slug}/integrations/`;

  const {
    data: integrations,
    isPending,
    isError,
  } = useQuery(
    apiOptions.as<Integration[]>()('/organizations/$organizationIdOrSlug/integrations/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {features: ['codeowners']},
      staleTime: Infinity,
    })
  );

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return <LoadingError />;
  }

  if (integrations.length) {
    return (
      <Fragment>
        <div>
          {t(
            "Configure code mapping to add your CODEOWNERS file. Select the integration you'd like to use for mapping:"
          )}
        </div>
        <IntegrationsList>
          {integrations.map(integration => (
            <LinkButton
              key={integration.id}
              to={`${baseUrl}${integration.provider.key}/${integration.id}/?tab=codeMappings&referrer=add-codeowners`}
            >
              {getIntegrationIcon(integration.provider.key)}
              <IntegrationName>{integration.name}</IntegrationName>
            </LinkButton>
          ))}
        </IntegrationsList>
      </Fragment>
    );
  }
  return (
    <Fragment>
      <div>{t('Install a GitHub or GitLab integration to use this feature.')}</div>
      <Flex justify="center" paddingTop="xl">
        <LinkButton variant="primary" size="sm" to={baseUrl}>
          Setup Integration
        </LinkButton>
      </Flex>
    </Fragment>
  );
}

function SourceFile({codeownersFile}: {codeownersFile: CodeownersFile}) {
  return (
    <ResultPanel>
      <SourceFileBody>
        <IconCheckmark size="md" variant="success" />
        {codeownersFile.filepath}
        <LinkButton size="sm" href={codeownersFile.html_url} external>
          {t('Preview File')}
        </LinkButton>
      </SourceFileBody>
    </ResultPanel>
  );
}

function NoSourceFile() {
  return (
    <ResultPanel>
      <NoSourceFileBody>
        <IconNot size="md" variant="danger" />
        {t('No codeowner file found.')}
      </NoSourceFileBody>
    </ResultPanel>
  );
}

function ErrorMessage({
  baseUrl,
  codeMappingId,
  codeMappings,
  errorJSON,
}: {
  baseUrl: string;
  codeMappingId: string | null;
  codeMappings: RepositoryProjectPathConfig[];
  errorJSON: {raw?: string} | null;
}) {
  const codeMapping = codeMappings.find(mapping => mapping.id === codeMappingId);
  const errActors = errorJSON?.raw?.[0]!.split('\n').map((el, i) => <p key={i}>{el}</p>);
  return (
    <Alert.Container>
      <Alert variant="danger">
        {errActors}
        {codeMapping && (
          <p>
            {tct(
              'Configure [userMappingsLink:User Mappings] or [teamMappingsLink:Team Mappings] for any missing associations.',
              {
                userMappingsLink: (
                  <Link
                    to={`${baseUrl}${codeMapping.provider?.key ?? ''}/${codeMapping.integrationId ?? ''}/?tab=userMappings&referrer=add-codeowners`}
                  />
                ),
                teamMappingsLink: (
                  <Link
                    to={`${baseUrl}${codeMapping.provider?.key ?? ''}/${codeMapping.integrationId ?? ''}/?tab=teamMappings&referrer=add-codeowners`}
                  />
                ),
              }
            )}
          </p>
        )}
        {tct(
          '[addAndSkip:Add and Skip Missing Associations] will add your codeowner file and skip any rules that having missing associations. You can add associations later for any skipped rules.',
          {addAndSkip: <strong>Add and Skip Missing Associations</strong>}
        )}
      </Alert>
    </Alert.Container>
  );
}

const ResultPanel = styled(Panel)`
  margin-bottom: 0;
`;
const NoSourceFileBody = styled(PanelBody)`
  display: grid;
  padding: 12px;
  grid-template-columns: 30px 1fr;
  align-items: center;
`;
const SourceFileBody = styled(PanelBody)`
  display: grid;
  padding: 12px;
  grid-template-columns: 30px 1fr auto;
  align-items: center;
`;

const IntegrationsList = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.md};
  justify-items: center;
  margin-top: ${p => p.theme.space.xl};
`;

const IntegrationName = styled('p')`
  padding-left: 10px;
`;
