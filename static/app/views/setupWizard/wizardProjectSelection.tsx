import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {ProjectLoadingError} from 'sentry/views/setupWizard/projectLoadingError';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';
import {useOrganizationProjects} from 'sentry/views/setupWizard/utils/useOrganizationProjects';
import {useUpdateWizardCache} from 'sentry/views/setupWizard/utils/useUpdateWizardCache';
import {WaitingForWizardToConnect} from 'sentry/views/setupWizard/waitingForWizardToConnect';

function getInitialOrgId(organizations: Organization[]) {
  if (organizations.length === 1) {
    return organizations[0]!.id;
  }

  const urlParams = new URLSearchParams(location.search);
  const orgSlug = urlParams.get('org_slug');
  const orgMatchingSlug = orgSlug && organizations.find(org => org.slug === orgSlug);

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

  const selectedOrg = useMemo(
    () => organizations.find(org => org.id === selectedOrgId),
    [organizations, selectedOrgId]
  );

  const orgProjectsRequest = useOrganizationProjects({
    organization: selectedOrg,
    query: debouncedSearch,
  });

  const {mutate: updateWizardCache, isPending, isSuccess} = useUpdateWizardCache(hash);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!selectedOrgId || !selectedProjectId) {
        return;
      }
      updateWizardCache(
        {
          organizationId: selectedOrgId,
          projectId: selectedProjectId,
        },
        {
          onError: () => {
            addErrorMessage(t('Something went wrong! Please try again.'));
          },
        }
      );
    },
    [selectedOrgId, selectedProjectId, updateWizardCache]
  );

  const orgOptions = useMemo(
    () =>
      organizations
        .map(org => ({
          value: org.id,
          label: org.name || org.slug,
          leadingItems: <OrganizationAvatar size={16} organization={org} />,
        }))
        .toSorted((a, b) => a.label.localeCompare(b.label)),
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

  const isFormValid = selectedOrg && selectedProject;

  if (isSuccess) {
    return <WaitingForWizardToConnect hash={hash} organizations={organizations} />;
  }

  let emptyMessage: React.ReactNode = tct('No projects found. [link:Create a project]', {
    organization: selectedOrg?.name || selectedOrg?.slug || 'organization',
    link: (
      <a
        href={`/organizations/${selectedOrg?.slug}/projects/new`}
        target="_blank"
        rel="noreferrer"
      />
    ),
  });

  if (orgProjectsRequest.isPending || isSearchStale) {
    emptyMessage = t('Loading...');
  }

  if (search) {
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
              icon: selectedProject ? (
                <ProjectBadge avatarSize={16} project={selectedProject} hideName />
              ) : null,
            }}
            triggerLabel={
              selectedProject?.name || (
                <SelectPlaceholder>{t('Select a project')}</SelectPlaceholder>
              )
            }
            onChange={({value}) => {
              setSelectedProjectId(value as string);
            }}
            emptyMessage={emptyMessage}
          />
        )}
      </FieldWrapper>
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

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;

  & > button {
    width: 100%;
  }
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
