import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Input from 'sentry/components/input';
import {canCreateProject} from 'sentry/components/projects/canCreateProject';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {ProjectLoadingError} from 'sentry/views/setupWizard/projectLoadingError';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';
import {hasSetupWizardCreateProjectFeature} from 'sentry/views/setupWizard/utils/features';
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

function getInitialOrgId(organizations: Organization[]) {
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
  organizations = [],
}: {
  hash: string;
  organizations: OrganizationWithRegion[];
}) {
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);
  const isSearchStale = search !== debouncedSearch;
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() =>
    getInitialOrgId(organizations)
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const isCreateProjectSelected = selectedProjectId === CREATE_PROJECT_VALUE;

  const [newProjectName, setNewProjectName] = useState(platformParam || '');
  const [newProjectTeam, setNewProjectTeam] = useState<string | null>(null);

  const selectedOrg = useMemo(
    () => organizations.find(org => org.id === selectedOrgId),
    [organizations, selectedOrgId]
  );

  const orgDetailsRequest = useOrganizationDetails({organization: selectedOrg});
  const teamsRequest = useOrganizationTeams({organization: selectedOrg});
  const orgProjectsRequest = useOrganizationProjects({
    organization: selectedOrg,
    query: debouncedSearch,
  });

  const isCreationEnabled =
    orgDetailsRequest.data &&
    teamsRequest.data &&
    teamsRequest.data.length > 0 &&
    hasSetupWizardCreateProjectFeature(orgDetailsRequest.data) &&
    canCreateProject(orgDetailsRequest.data) &&
    platformParam;

  const updateWizardCacheMutation = useUpdateWizardCache(hash);
  const createProjectMutation = useCreateProjectFromWizard();

  const isPending =
    updateWizardCacheMutation.isPending || createProjectMutation.isPending;
  const isSuccess = isCreateProjectSelected
    ? updateWizardCacheMutation.isSuccess && createProjectMutation.isSuccess
    : updateWizardCacheMutation.isSuccess;

  const orgOptions = useMemo(
    () =>
      organizations
        .map(org => ({
          value: org.id,
          label: org.name || org.slug,
          leadingItems: <OrganizationAvatar size={16} organization={org} />,
        }))
        .toSorted((a: any, b: any) => a.label.localeCompare(b.label)),
    [organizations]
  );

  const projectOptions = useMemo(
    () =>
      (orgProjectsRequest.data || []).map(project => ({
        value: project.id,
        label: project.name,
        leadingItems: <ProjectBadge avatarSize={16} project={project} hideName />,
        project,
      })),
    [orgProjectsRequest.data]
  );

  const {options: cachedProjectOptions, clear: clearProjectOptions} =
    useCompactSelectOptionsCache(projectOptions);

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

  const selectedTeam = useMemo(
    () => teamsRequest.data?.find(team => team.slug === newProjectTeam),
    [newProjectTeam, teamsRequest]
  );

  const isProjectSelected = isCreateProjectSelected
    ? newProjectName && newProjectTeam
    : selectedProject;

  const isFormValid = selectedOrg && isProjectSelected;

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isFormValid || !selectedOrg || !selectedProjectId) {
        return;
      }

      let projectId = selectedProjectId;
      try {
        if (isCreateProjectSelected) {
          const project = await createProjectMutation.mutateAsync({
            organization: selectedOrg,
            team: newProjectTeam!,
            name: newProjectName,
            platform: platformParam || 'other',
          });

          projectId = project.id;
        }
      } catch {
        addErrorMessage('Failed to create project! Please try again');
        return;
      }

      try {
        await updateWizardCacheMutation.mutateAsync({
          organizationId: selectedOrg.id,
          projectId,
        });
      } catch {
        addErrorMessage(t('Something went wrong! Please try again.'));
      }
    },
    [
      isFormValid,
      selectedOrg,
      selectedProjectId,
      isCreateProjectSelected,
      createProjectMutation,
      newProjectTeam,
      newProjectName,
      updateWizardCacheMutation,
    ]
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

  return (
    <StyledForm onSubmit={handleSubmit}>
      <Heading>{t('Select your Sentry project')}</Heading>
      <FieldWrapper>
        <label>{t('Organization')}</label>
        <StyledCompactSelect
          autoFocus
          value={selectedOrgId as string}
          searchable
          options={orgOptions}
          triggerProps={{
            icon: selectedOrg ? (
              <OrganizationAvatar size={16} organization={selectedOrg} />
            ) : null,
          }}
          triggerLabel={
            selectedOrg?.name ||
            selectedOrg?.slug || (
              <SelectPlaceholder>{t('Select an organization')}</SelectPlaceholder>
            )
          }
          onChange={({value}) => {
            if (value !== selectedOrgId) {
              setSelectedOrgId(value as string);
              setSelectedProjectId(null);
              clearProjectOptions();
            }
          }}
        />
      </FieldWrapper>
      <FieldWrapper>
        <label>{t('Project')}</label>
        {orgProjectsRequest.error ? (
          <ProjectLoadingError
            error={orgProjectsRequest.error}
            onRetry={orgProjectsRequest.refetch}
          />
        ) : (
          <StyledCompactSelect
            // Remount the component when the org changes to reset the component state
            key={selectedOrgId}
            onSearch={setSearch}
            onClose={() => setSearch('')}
            disabled={!selectedOrgId}
            value={selectedProjectId as string}
            searchable
            options={sortedProjectOptions}
            triggerProps={{
              icon: isCreateProjectSelected ? (
                <IconAdd isCircled />
              ) : selectedProject ? (
                <ProjectBadge avatarSize={16} project={selectedProject} hideName />
              ) : null,
            }}
            triggerLabel={
              isCreateProjectSelected
                ? t('Create Project')
                : selectedProject?.name || (
                    <SelectPlaceholder>{t('Select a project')}</SelectPlaceholder>
                  )
            }
            onChange={({value}) => {
              setSelectedProjectId(value as string);
            }}
            emptyMessage={emptyMessage}
            menuFooter={
              isCreationEnabled
                ? ({closeOverlay}) => (
                    <AlignRight>
                      <Button
                        size="xs"
                        onClick={() => {
                          setSelectedProjectId(CREATE_PROJECT_VALUE);
                          closeOverlay();
                        }}
                        icon={<IconAdd isCircled />}
                      >
                        {t('Create Project')}
                      </Button>
                    </AlignRight>
                  )
                : undefined
            }
          />
        )}
      </FieldWrapper>
      {isCreateProjectSelected && (
        <Fragment>
          <Columns>
            <FieldWrapper>
              <label>{t('Project Name')}</label>
              <Input
                value={newProjectName}
                onChange={event => setNewProjectName(event.target.value)}
                placeholder={t('Enter a project name')}
              />
            </FieldWrapper>
            <FieldWrapper>
              <label>{t('Team')}</label>
              <StyledCompactSelect
                value={newProjectTeam as string}
                options={
                  teamsRequest.data?.map(team => ({
                    value: team.slug,
                    label: `#${team.slug}`,
                    leadingItems: <IdBadge team={team} hideName />,
                    searchKey: team.slug,
                  })) || []
                }
                triggerLabel={selectedTeam ? `#${selectedTeam.slug}` : t('Select a team')}
                triggerProps={{
                  icon: selectedTeam ? (
                    <IdBadge avatarSize={16} team={selectedTeam} hideName />
                  ) : null,
                }}
                onChange={({value}) => {
                  setNewProjectTeam(value as string);
                }}
              />
            </FieldWrapper>
          </Columns>
        </Fragment>
      )}
      <SubmitButton disabled={!isFormValid || isPending} priority="primary" type="submit">
        {t('Continue')}
      </SubmitButton>
    </StyledForm>
  );
}

const StyledForm = styled('form')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const Heading = styled('h5')`
  margin-bottom: ${space(0.5)};
`;

const FieldWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const Columns = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 1fr;
  }
`;

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;

  & > button {
    width: 100%;
  }
`;

const AlignRight = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const SelectPlaceholder = styled('span')`
  ${p => p.theme.overflowEllipsis}
  color: ${p => p.theme.subText};
  font-weight: normal;
  text-align: left;
`;

const SubmitButton = styled(Button)`
  margin-top: ${space(1)};
`;
