import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {PlatformIcon} from 'platformicons';
import {z} from 'zod';

import {OrganizationAvatar} from '@sentry/scraps/avatar';
import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {IdBadge} from 'sentry/components/idBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {canCreateProject} from 'sentry/components/projects/canCreateProject';
import {createablePlatforms} from 'sentry/data/platformPickerCategories';
import {allPlatforms as platforms} from 'sentry/data/platforms';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {ProjectLoadingError} from 'sentry/views/setupWizard/projectLoadingError';
import type {OrganizationSummaryWithLocality} from 'sentry/views/setupWizard/types';
import {useCreateProjectFromWizard} from 'sentry/views/setupWizard/utils/useCreateProjectFromWizard';
import {useOrganizationDetails} from 'sentry/views/setupWizard/utils/useOrganizationDetails';
import {useOrganizationProjects} from 'sentry/views/setupWizard/utils/useOrganizationProjects';
import {useOrganizationTeams} from 'sentry/views/setupWizard/utils/useOrganizationTeams';
import {useUpdateWizardCache} from 'sentry/views/setupWizard/utils/useUpdateWizardCache';
import {WaitingForWizardToConnect} from 'sentry/views/setupWizard/waitingForWizardToConnect';

const CREATE_PROJECT_VALUE = 'create-new-project';

const urlParams = new URLSearchParams(location.search);
const platformParam = urlParams.get('project_platform');
const orgSlugParam = urlParams.get('org_slug');

type WizardFormValues = {
  newProjectName: string;
  newProjectPlatform: string | null;
  newProjectTeam: string | null;
  organizationId: string | null;
  projectId: string | null;
};

const wizardSchema = z.object({
  organizationId: z
    .string()
    .nullable()
    .refine(value => value !== null, t('Select an organization')),
  projectId: z
    .string()
    .nullable()
    .refine(value => value !== null, t('Select a project')),
  newProjectName: z.string(),
  newProjectPlatform: z.string().nullable(),
  newProjectTeam: z.string().nullable(),
});

function getOrgDisplayName(organization: OrganizationSummary) {
  return organization.name || organization.slug;
}

function getInitialOrgId(organizations: OrganizationSummary[]) {
  if (organizations.length === 1) {
    return organizations[0]!.id;
  }

  const orgMatchingSlug =
    orgSlugParam && organizations.find(org => org.slug === orgSlugParam);

  if (orgMatchingSlug) {
    return orgMatchingSlug.id;
  }

  const lastOrgSlug = ConfigStore.get('lastOrganization');
  const lastOrg = lastOrgSlug && organizations.find(org => org.slug === lastOrgSlug);
  // Pre-fill the last used org if there are multiple and no URL param
  if (lastOrg) {
    return lastOrg.id;
  }
  return null;
}

export function WizardProjectSelection({
  hash,
  organizations,
}: {
  hash: string;
  organizations: OrganizationSummaryWithLocality[];
}) {
  const [search, setSearch] = useState('');

  const [debouncedSearch] = useDebouncedValue(search, {wait: 300});
  const isSearchStale = search !== debouncedSearch;
  const updateWizardCacheMutation = useUpdateWizardCache(hash);
  const createProjectMutation = useCreateProjectFromWizard();

  const defaultValues: WizardFormValues = {
    organizationId: getInitialOrgId(organizations),
    projectId: null,
    newProjectName: platformParam || '',
    newProjectPlatform: platformParam || null,
    newProjectTeam: null,
  };
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: wizardSchema},
    onSubmit: async ({value}) => {
      const parsedValue = wizardSchema.parse(value);
      const organization = organizations.find(
        org => org.id === parsedValue.organizationId
      );
      if (!organization) {
        return;
      }

      let projectId = parsedValue.projectId;
      if (projectId === CREATE_PROJECT_VALUE) {
        const project = await createProjectMutation
          .mutateAsync({
            organization,
            team: parsedValue.newProjectTeam,
            name: parsedValue.newProjectName,
            platform: parsedValue.newProjectPlatform || platformParam || 'other',
          })
          .catch(() => null);

        if (!project) {
          return;
        }

        projectId = project.id;
      }

      await updateWizardCacheMutation
        .mutateAsync({
          organizationId: organization.id,
          projectId,
        })
        .catch(() => {});
    },
  });
  const selectedOrgId = useStore(form.store, state => state.values.organizationId);
  const selectedProjectId = useStore(form.store, state => state.values.projectId);
  const isCreateProjectSelected = selectedProjectId === CREATE_PROJECT_VALUE;

  const selectedOrg = useMemo(
    () => organizations.find(org => org.id === selectedOrgId),
    [organizations, selectedOrgId]
  );

  const orgDetailsRequest = useOrganizationDetails({
    organization: selectedOrg,
  });
  const teamsRequest = useOrganizationTeams({organization: selectedOrg});

  const accessTeams = useMemo(() => {
    return teamsRequest.data?.filter(team => team.access.includes('team:admin'));
  }, [teamsRequest.data]);

  const selectableTeams = useMemo(() => {
    if (orgDetailsRequest.data?.access.includes('org:admin')) {
      return teamsRequest.data;
    }
    return accessTeams;
  }, [orgDetailsRequest.data, teamsRequest.data, accessTeams]);

  const orgProjectsRequest = useOrganizationProjects({
    organization: selectedOrg,
    query: debouncedSearch,
  });

  const canCreateTeam = orgDetailsRequest.data?.access.includes('project:admin') ?? false;
  const isOrgMemberWithNoAccess = (accessTeams ?? []).length === 0 && !canCreateTeam;
  const canUserCreateProject = orgDetailsRequest.data
    ? canCreateProject(orgDetailsRequest.data, selectableTeams)
    : false;
  const hasSelectableTeams = (selectableTeams ?? []).length > 0;
  const isCreationEnabled =
    canUserCreateProject && (isOrgMemberWithNoAccess || hasSelectableTeams);

  const isSuccess = isCreateProjectSelected
    ? updateWizardCacheMutation.isSuccess && createProjectMutation.isSuccess
    : updateWizardCacheMutation.isSuccess;

  const orgOptions = useMemo(
    () =>
      organizations
        .map(org => ({
          value: org.id,
          label: getOrgDisplayName(org),
          leadingItems: <OrganizationAvatar size={16} organization={org} />,
        }))
        .toSorted((a: any, b: any) => a.label.localeCompare(b.label)),
    [organizations]
  );

  const projectOptions = useMemo(
    () =>
      (orgProjectsRequest.data || []).map(project => ({
        value: project.id,
        label: project.slug,
        leadingItems: <ProjectBadge avatarSize={16} project={project} hideName />,
        project,
      })),
    [orgProjectsRequest.data]
  );

  const {options: cachedProjectOptions, clear: clearProjectOptions} =
    useCompactSelectOptionsCache(projectOptions);

  const platformOptions = useMemo(
    () =>
      platforms
        .filter(platform => createablePlatforms.has(platform.id))
        .map(platform => ({
          value: platform.id,
          label: platform.name,
          leadingItems: <PlatformIcon platform={platform.id} size={16} alt="" />,
          searchKey: platform.name,
        })),
    []
  );

  // Set the selected project to the first option if there is only one
  useEffect(() => {
    // We need to check the cached options as they hold all options that were fetched for the org
    // and not just the options that match the search query
    const firstProjectOption = cachedProjectOptions.at(0);
    if (cachedProjectOptions.length === 1 && firstProjectOption) {
      form.setFieldValue('projectId', firstProjectOption.value);
    }
  }, [cachedProjectOptions, form]);

  // Set the selected team to the first team if there is only one
  useEffect(() => {
    if (selectableTeams?.length === 1) {
      const teamSlug = selectableTeams[0]!.slug;
      form.setFieldValue('newProjectTeam', teamSlug);
    }
  }, [form, selectableTeams]);

  // As the cache hook sorts the options by value, we need to sort them afterwards
  const sortedProjectOptions = useMemo(
    () =>
      cachedProjectOptions.sort((a, b) => {
        return a.label.localeCompare(b.label);
      }),
    [cachedProjectOptions]
  );

  // Select the project from the cached options to avoid visually clearing the input
  // when searching while having a selected project
  const selectedProject = useMemo(
    () =>
      sortedProjectOptions?.find(option => option.value === selectedProjectId)?.project,
    [selectedProjectId, sortedProjectOptions]
  );

  if (isSuccess) {
    return <WaitingForWizardToConnect hash={hash} organizations={organizations} />;
  }

  let emptyMessage: React.ReactNode = t('No projects found.');

  if (orgProjectsRequest.isPending || isSearchStale) {
    emptyMessage = t('Loading...');
  } else if (search) {
    emptyMessage = t('No projects matching search');
  }

  const platformField = (
    <form.AppField
      name="newProjectPlatform"
      validators={{
        onDynamic: z
          .string()
          .nullable()
          .refine(value => value !== null, t('Select a platform')),
      }}
    >
      {field => (
        <field.Layout.Stack label={t('Platform')} required>
          <field.Base<HTMLButtonElement>>
            {baseProps => {
              const selectedPlatform = field.state.value;
              return (
                <StyledCompactSelect
                  value={field.state.value ?? undefined}
                  search
                  options={platformOptions}
                  trigger={triggerProps => (
                    <OverlayTrigger.Button
                      {...triggerProps}
                      {...baseProps}
                      icon={
                        selectedPlatform ? (
                          <PlatformIcon platform={selectedPlatform} size={16} alt="" />
                        ) : null
                      }
                    >
                      {selectedPlatform
                        ? (platforms.find(p => p.id === selectedPlatform)?.name ??
                          selectedPlatform)
                        : t('Select a platform')}
                    </OverlayTrigger.Button>
                  )}
                  onChange={({value}) => {
                    field.handleChange(value as string);
                  }}
                />
              );
            }}
          </field.Base>
        </field.Layout.Stack>
      )}
    </form.AppField>
  );

  const projectNameField = (
    <form.AppField
      name="newProjectName"
      validators={{onDynamic: z.string().min(1, t('Enter a project slug'))}}
    >
      {field => (
        <field.Layout.Stack label={t('Project Slug')} required>
          <field.Input
            value={field.state.value}
            onChange={field.handleChange}
            placeholder={t('Enter a project slug')}
          />
        </field.Layout.Stack>
      )}
    </form.AppField>
  );

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        <Heading as="h5" size="xl">
          {t('Select your Sentry project')}
        </Heading>
        <form.AppField name="organizationId">
          {field => (
            <field.Layout.Stack label={t('Organization')} required>
              <field.Base<HTMLButtonElement>>
                {baseProps => (
                  <StyledCompactSelect
                    autoFocus
                    value={field.state.value ?? undefined}
                    search
                    options={orgOptions}
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        {...baseProps}
                        icon={
                          selectedOrg ? (
                            <OrganizationAvatar size={16} organization={selectedOrg} />
                          ) : null
                        }
                      >
                        {selectedOrg ? (
                          getOrgDisplayName(selectedOrg)
                        ) : (
                          <Text ellipsis variant="muted" bold={false} align="left">
                            {t('Select an organization')}
                          </Text>
                        )}
                      </OverlayTrigger.Button>
                    )}
                    onChange={({value}) => {
                      if (value !== selectedOrgId) {
                        const organizationId = value as string;
                        field.handleChange(organizationId);
                        form.setFieldValue('projectId', null);
                        clearProjectOptions();
                      }
                    }}
                  />
                )}
              </field.Base>
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="projectId">
          {field => (
            <field.Layout.Stack label={t('Project')} required>
              {orgProjectsRequest.error instanceof RequestError ? (
                <ProjectLoadingError
                  error={orgProjectsRequest.error}
                  onRetry={orgProjectsRequest.refetch}
                />
              ) : (
                <field.Base<HTMLButtonElement>>
                  {baseProps => (
                    <StyledCompactSelect
                      // Remount the component when the org changes to reset the component state
                      key={selectedOrgId}
                      search={{onChange: setSearch}}
                      onClose={() => setSearch('')}
                      disabled={!selectedOrgId}
                      value={selectedProjectId!}
                      options={sortedProjectOptions}
                      trigger={triggerProps => (
                        <OverlayTrigger.Button
                          {...triggerProps}
                          {...baseProps}
                          icon={
                            isCreateProjectSelected ? (
                              <IconAdd />
                            ) : selectedProject ? (
                              <ProjectBadge
                                avatarSize={16}
                                project={selectedProject}
                                hideName
                              />
                            ) : null
                          }
                        >
                          {isCreateProjectSelected
                            ? t('Create Project')
                            : selectedProject?.slug || (
                                <Text ellipsis variant="muted" bold={false} align="left">
                                  {t('Select a project')}
                                </Text>
                              )}
                        </OverlayTrigger.Button>
                      )}
                      onChange={({value}) => {
                        field.handleChange(value as string);
                      }}
                      emptyMessage={emptyMessage}
                      menuFooter={
                        isCreationEnabled
                          ? ({closeOverlay}) => (
                              <MenuComponents.CTAButton
                                onClick={() => {
                                  field.handleChange(CREATE_PROJECT_VALUE);
                                  closeOverlay();
                                }}
                                icon={<IconAdd />}
                              >
                                {t('Create Project')}
                              </MenuComponents.CTAButton>
                            )
                          : undefined
                      }
                    />
                  )}
                </field.Base>
              )}
            </field.Layout.Stack>
          )}
        </form.AppField>
        {isCreateProjectSelected &&
          (isOrgMemberWithNoAccess ? (
            <Fragment>
              {!platformParam && platformField}
              {projectNameField}
            </Fragment>
          ) : (
            <Fragment>
              {!platformParam && platformField}
              <Grid columns={{zero: '1fr', sm: '1fr 1fr'}} gap="xl">
                {projectNameField}
                <form.AppField
                  name="newProjectTeam"
                  validators={{
                    onDynamic: z
                      .string()
                      .nullable()
                      .refine(value => value !== null, t('Select a team')),
                  }}
                >
                  {field => (
                    <field.Layout.Stack label={t('Team')} required>
                      <field.Base<HTMLButtonElement>>
                        {baseProps => {
                          const selectedTeam = selectableTeams?.find(
                            team => team.slug === field.state.value
                          );
                          return (
                            <StyledCompactSelect
                              value={field.state.value ?? undefined}
                              options={
                                selectableTeams?.map(team => ({
                                  value: team.slug,
                                  label: `#${team.slug}`,
                                  leadingItems: <IdBadge team={team} hideName />,
                                  searchKey: team.slug,
                                })) || []
                              }
                              trigger={triggerProps => (
                                <OverlayTrigger.Button
                                  {...triggerProps}
                                  {...baseProps}
                                  icon={
                                    selectedTeam ? (
                                      <IdBadge
                                        avatarSize={16}
                                        team={selectedTeam}
                                        hideName
                                      />
                                    ) : null
                                  }
                                >
                                  {selectedTeam
                                    ? `#${selectedTeam.slug}`
                                    : t('Select a team')}
                                </OverlayTrigger.Button>
                              )}
                              onChange={({value}) => {
                                field.handleChange(value as string);
                              }}
                            />
                          );
                        }}
                      </field.Base>
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              </Grid>
            </Fragment>
          ))}
        <Flex justify="end" borderTop="secondary" paddingTop="xl">
          <form.SubmitButton>{t('Continue')}</form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;

  & > button {
    width: 100%;
  }
`;
