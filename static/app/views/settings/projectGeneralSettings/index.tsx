import {useCallback, useEffect, useRef} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  changeProjectSlug,
  removeProject,
  transferProject,
} from 'sentry/actionCreators/projects';
import {hasEveryAccess} from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import TextField from 'sentry/components/forms/fields/textField';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldValue} from 'sentry/components/forms/model';
import type {FieldObject} from 'sentry/components/forms/types';
import Hook from 'sentry/components/hook';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {removePageFiltersStorage} from 'sentry/components/organizations/pageFilters/persistence';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {fields} from 'sentry/data/forms/projectGeneralSettings';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Project} from 'sentry/types/project';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import recreateRoute from 'sentry/utils/recreateRoute';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

type Props = {
  onChangeSlug: (slug: string) => void;
};

function ProjectGeneralSettings({onChangeSlug}: Props) {
  const form: Record<string, FieldValue> = {};
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const organization = useOrganization();
  const {projectId} = useParams<{projectId: string}>();
  const api = useApi({persistInFlight: true});

  const makeProjectSettingsQueryKey: ApiQueryKey = [
    `/projects/${organization.slug}/${projectId}/`,
  ];

  const {
    data: project,
    isPending,
    isError,
    refetch,
  } = useApiQuery<Project>(makeProjectSettingsQueryKey, {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const handleTransferFieldChange = (id: string, value: FieldValue) => {
    form[id] = value;
  };

  const handleRemoveProject = async () => {
    removePageFiltersStorage(organization.slug);

    if (!project) {
      return;
    }

    try {
      await removeProject({
        api,
        orgSlug: organization.slug,
        projectSlug: project.slug,
        origin: 'settings',
      });
    } catch (err) {
      addErrorMessage(tct('Error removing [project]', {project: project.slug}));
      throw err;
    }

    addSuccessMessage(tct('[project] was successfully removed', {project: project.slug}));
    navigate(`/settings/${organization.slug}/projects/`);
  };

  const handleTransferProject = async () => {
    if (!project) {
      return;
    }
    if (typeof form.email !== 'string' || form.email.length < 1) {
      return;
    }

    try {
      await transferProject(api, organization.slug, project, form.email);
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    } catch (err) {
      if (err.status >= 500) {
        handleXhrErrorResponse('Unable to transfer project', err);
      }
    }
  };

  const renderRemoveProject = () => {
    const isProjectAdmin = hasEveryAccess(['project:admin'], {
      organization,
      project,
    });
    const {isInternal} = project;

    return (
      <FieldGroup
        label={t('Remove Project')}
        help={tct(
          'Remove the [project] project and all related data. [linebreak] Careful, this action cannot be undone.',
          {
            project: <strong>{project.slug}</strong>,
            linebreak: <br />,
          }
        )}
      >
        {!isProjectAdmin &&
          t('You do not have the required permission to remove this project.')}

        {isInternal &&
          t(
            'This project cannot be removed. It is used internally by the Sentry server.'
          )}

        {isProjectAdmin && !isInternal && (
          <Confirm
            onConfirm={handleRemoveProject}
            priority="danger"
            confirmText={t('Remove Project')}
            message={
              <div>
                <TextBlock>
                  <strong>
                    {t('Removing this project is permanent and cannot be undone!')}
                  </strong>
                </TextBlock>
                <TextBlock>
                  {t('This will also remove all associated event data.')}
                </TextBlock>
              </div>
            }
          >
            <div>
              <Button priority="danger">{t('Remove Project')}</Button>
            </div>
          </Confirm>
        )}
      </FieldGroup>
    );
  };

  const renderTransferProject = () => {
    const {isInternal} = project;
    const isOrgOwner = hasEveryAccess(['org:admin'], {
      organization,
    });

    return (
      <FieldGroup
        label={t('Transfer Project')}
        help={tct(
          'Transfer the [project] project and all related data. [linebreak] Careful, this action cannot be undone.',
          {
            project: <strong>{project.slug}</strong>,
            linebreak: <br />,
          }
        )}
      >
        {!isOrgOwner &&
          t('You do not have the required permission to transfer this project.')}

        {isInternal &&
          t(
            'This project cannot be transferred. It is used internally by the Sentry server.'
          )}

        {isOrgOwner && !isInternal && (
          <Confirm
            onConfirm={() => {
              handleTransferProject();
            }}
            priority="danger"
            confirmText={t('Transfer project')}
            renderMessage={({confirm}) => (
              <div>
                <TextBlock>
                  <strong>
                    {t('Transferring this project is permanent and cannot be undone!')}
                  </strong>
                </TextBlock>
                <TextBlock>
                  {t(
                    'Please enter the email of an organization owner to whom you would like to transfer this project. Note: It is not possible to transfer projects between organizations in different regions.'
                  )}
                </TextBlock>
                <Panel>
                  <Form
                    hideFooter
                    onFieldChange={handleTransferFieldChange}
                    onSubmit={(_data, _onSuccess, _onError, e) => {
                      e.stopPropagation();
                      confirm();
                    }}
                  >
                    <TextField
                      name="email"
                      label={t('Organization Owner')}
                      placeholder="admin@example.com"
                      required
                      help={t(
                        'A request will be emailed to this address, asking the organization owner to accept the project transfer.'
                      )}
                    />
                  </Form>
                </Panel>
              </div>
            )}
          >
            <div>
              <Button priority="danger">{t('Transfer Project')}</Button>
            </div>
          </Confirm>
        )}
      </FieldGroup>
    );
  };

  const endpoint = `/projects/${organization.slug}/${projectId}/`;
  const access = new Set(organization.access.concat(project.access));

  const jsonFormProps = {
    additionalFieldProps: {
      organization,
      project,
    },
    features: new Set(organization.features),
    access,
    disabled: !hasEveryAccess(['project:write'], {organization, project}),
  };

  const team = project.teams.length ? project.teams?.[0] : undefined;

  // XXX: HACK
  //
  // The <Form /> component applies its props to its children meaning the
  // hooked component would need to conform to the form settings applied in a
  // separate repository. This is not feasible to maintain and may introduce
  // compatibility errors if something changes in either repository. For that
  // reason, the Form component is split in two, since the fields do not
  // depend on one another, allowing for the Hook to manage its own state.
  const formProps: FormProps = {
    saveOnBlur: true,
    allowUndo: true,
    initialData: {
      ...project,
      team,
    },
    apiMethod: 'PUT' as const,
    apiEndpoint: endpoint,
    onSubmitSuccess: resp => {
      setApiQueryData(queryClient, makeProjectSettingsQueryKey, resp);
      if (projectId !== resp.slug) {
        changeProjectSlug(projectId, resp.slug);
        // Container will redirect after stores get updated with new slug
        onChangeSlug(resp.slug);
      }
      // This will update our project context
      ProjectsStore.onUpdateSuccess(resp);
    },
  };

  const projectIdField: FieldObject = {
    name: 'projectId',
    type: 'string',
    disabled: true,
    label: t('Project ID'),
    setValue(_, _name) {
      return project.id;
    },
    help: t('The unique identifier for this project. It cannot be modified.'),
  };

  return (
    <div>
      <SentryDocumentTitle title={t('Project Settings')} projectSlug={project.slug} />
      <SettingsPageHeader title={t('Project Settings')} />
      <ProjectPermissionAlert project={project} />
      <Form {...formProps}>
        <JsonForm
          {...jsonFormProps}
          title={t('Project Details')}
          fields={[fields.name, projectIdField, fields.platform]}
        />
        <JsonForm {...jsonFormProps} title={t('Email')} fields={[fields.subjectPrefix]} />
      </Form>
      <Hook name="spend-visibility:spike-protection-project-settings" project={project} />
      <Form {...formProps}>
        <JsonForm
          {...jsonFormProps}
          title={t('Event Settings')}
          fields={[fields.resolveAge]}
        />

        <JsonForm
          {...jsonFormProps}
          title={t('Client Security')}
          fields={[
            fields.allowedDomains,
            fields.scrapeJavaScript,
            fields.securityToken,
            fields.securityTokenHeader,
            fields.verifySSL,
          ]}
          renderHeader={() => (
            <PanelAlert type="info">
              <TextBlock noMargin>
                {tct(
                  'Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].',
                  {
                    link: (
                      <ExternalLink href="https://github.com/getsentry/sentry-javascript">
                        sentry-javascript
                      </ExternalLink>
                    ),
                  }
                )}{' '}
                {tct(
                  'This will restrict requests based on the [code:Origin] and [code:Referer] headers.',
                  {
                    code: <code />,
                  }
                )}
              </TextBlock>
            </PanelAlert>
          )}
        />
      </Form>

      <Panel>
        <PanelHeader>{t('Project Administration')}</PanelHeader>
        {renderRemoveProject()}
        {renderTransferProject()}
      </Panel>
    </div>
  );
}

function ProjectGeneralSettingsContainer() {
  const routes = useRoutes();
  const navigate = useNavigate();
  const projects = useLegacyStore(ProjectsStore);
  const organization = useOrganization();
  const location = useLocation();

  // Use a ref to track the most current slug value
  const changedSlugRef = useRef<string | undefined>(undefined);

  const setChangedSlug = useCallback((newSlug: string) => {
    changedSlugRef.current = newSlug;
  }, []);

  useEffect(() => {
    if (changedSlugRef.current) {
      const project = projects.projects.find(p => p.slug === changedSlugRef.current);

      if (project) {
        navigate(
          recreateRoute('', {
            params: {
              orgId: organization.slug,
              projectId: changedSlugRef.current,
            },
            routes,
            location,
          }),
          {replace: true}
        );
      }
    }
  }, [projects, navigate, routes, location, organization.slug]);

  return <ProjectGeneralSettings onChangeSlug={setChangedSlug} />;
}

export {ProjectGeneralSettings};
export default ProjectGeneralSettingsContainer;
