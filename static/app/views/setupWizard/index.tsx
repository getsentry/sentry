import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

function useAnalyticsParams(organizations: Organization[] | undefined) {
  const urlParams = new URLSearchParams(location.search);
  const projectPlatform = urlParams.get('project_platform') ?? undefined;

  // if we have exactly one organization, we can use it for analytics
  // otherwise we don't know which org the user is in
  return useMemo(
    () => ({
      organization: organizations?.length === 1 ? organizations[0] : null,
      project_platform: projectPlatform,
    }),
    [organizations, projectPlatform]
  );
}

const useLastOrganization = (organizations: Organization[]) => {
  const lastOrgSlug = ConfigStore.get('lastOrganization');
  return useMemo(() => {
    if (!lastOrgSlug) {
      return null;
    }
    return organizations.find(org => org.slug === lastOrgSlug);
  }, [organizations, lastOrgSlug]);
};

function useOrganizationProjects(organization?: Organization & {region: string}) {
  const api = useApi();
  const regions = useMemo(() => ConfigStore.get('memberRegions'), []);
  const orgRegion = useMemo(
    () => regions.find(region => region.name === organization?.region),
    [regions, organization?.region]
  );

  return useQuery<Project[]>({
    queryKey: [`/organizations/${organization?.slug}/projects/`],
    queryFn: () => {
      return api.requestPromise(`/organizations/${organization?.slug}/projects/`, {
        host: orgRegion?.url,
      });
    },
    enabled: !!(orgRegion && organization),
    refetchOnWindowFocus: true,
  });
}

type Props = {
  enableProjectSelection?: boolean;
  hash?: boolean | string;
  organizations?: (Organization & {region: string})[];
};

function SetupWizard({
  hash = false,
  organizations,
  enableProjectSelection = false,
}: Props) {
  const analyticsParams = useAnalyticsParams(organizations);

  useEffect(() => {
    trackAnalytics('setup_wizard.viewed', analyticsParams);
  }, [analyticsParams]);

  return (
    <ThemeAndStyleProvider>
      <QueryClientProvider client={queryClient}>
        {enableProjectSelection ? (
          <ProjectSelection hash={hash} organizations={organizations} />
        ) : (
          <WaitingForWizardToConnect hash={hash} organizations={organizations} />
        )}
      </QueryClientProvider>
    </ThemeAndStyleProvider>
  );
}

const BASE_API_CLIENT = new Client({baseUrl: ''});

function ProjectSelection({hash, organizations = []}: Omit<Props, 'allowSelection'>) {
  const baseApi = useApi({api: BASE_API_CLIENT});
  const lastOrganization = useLastOrganization(organizations);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    if (organizations.length === 1) {
      return organizations[0].id;
    }
    // Pre-fill the last used org if there are multiple
    if (lastOrganization) {
      return lastOrganization.id;
    }
    return null;
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedOrg = useMemo(
    () => organizations.find(org => org.id === selectedOrgId),
    [organizations, selectedOrgId]
  );

  const orgProjectsRequest = useOrganizationProjects(selectedOrg);

  const selectedProject = useMemo(
    () => orgProjectsRequest.data?.find(org => org.id === selectedProjectId),
    [orgProjectsRequest.data, selectedProjectId]
  );

  const {
    mutate: updateCache,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: (params: {organizationId: string; projectId: string}) => {
      return baseApi.requestPromise(`/account/settings/wizard/${hash}/`, {
        method: 'POST',
        data: params,
      });
    },
  });

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!selectedOrgId || !selectedProjectId) {
        return;
      }
      updateCache(
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
    [selectedOrgId, selectedProjectId, updateCache]
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
      (orgProjectsRequest.data || [])
        .toSorted(
          (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
        )
        .map(project => ({
          value: project.id,
          label: project.name,
          leadingItems: <ProjectBadge avatarSize={16} project={project} hideName />,
        })),
    [orgProjectsRequest.data]
  );

  const isFormValid = selectedOrg && selectedProject;

  if (isSuccess) {
    return <WaitingForWizardToConnect hash={hash} organizations={organizations} />;
  }

  return (
    <StyledForm onSubmit={handleSubmit}>
      <Heading>{t('Select your Sentry project')}</Heading>
      <FieldWrapper>
        <label>{t('Organization')}</label>
        <StyledCompactSelect
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
            }
          }}
        />
      </FieldWrapper>
      <FieldWrapper>
        <label>{t('Project')}</label>
        {orgProjectsRequest.isError ? (
          <LoadingError
            message={t('Failed to load projects')}
            onRetry={() => orgProjectsRequest.refetch()}
          />
        ) : (
          <StyledCompactSelect
            // Remount the component when the org changes to reset the component state
            // TODO(aknaus): investigate why the selection is not reset when the value changes to null
            key={selectedOrgId}
            disabled={!selectedOrgId || orgProjectsRequest.isPending}
            value={selectedProjectId as string}
            searchable
            options={projectOptions}
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
            emptyMessage={tct('No projects found. [link:Create a project]', {
              organization: selectedOrg?.name || selectedOrg?.slug || 'organization',
              link: (
                <a
                  href={`/organizations/${selectedOrg?.slug}/projects/new`}
                  target="_blank"
                  rel="noreferrer"
                />
              ),
            })}
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

function WaitingForWizardToConnect({
  hash,
  organizations,
}: Omit<Props, 'allowSelection' | 'projects'>) {
  const api = useApi();
  const closeTimeoutRef = useRef<number | undefined>(undefined);
  const [finished, setFinished] = useState(false);

  const analyticsParams = useAnalyticsParams(organizations);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const checkFinished = useCallback(async () => {
    if (finished) {
      return;
    }
    try {
      await api.requestPromise(`/wizard/${hash}/`);
    } catch {
      setFinished(true);
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = window.setTimeout(() => window.close(), 10000);
      trackAnalytics('setup_wizard.complete', analyticsParams);
    }
  }, [api, hash, analyticsParams, finished]);

  useEffect(() => {
    const pollingInterval = window.setInterval(checkFinished, 1000);
    return () => window.clearInterval(pollingInterval);
  }, [checkFinished]);

  return !finished ? (
    <LoadingIndicator style={{margin: '2em auto'}}>
      <h5>{t('Waiting for wizard to connect')}</h5>
    </LoadingIndicator>
  ) : (
    <SuccessWrapper>
      <SuccessCheckmark color="green300" size="xl" isCircled />
      <SuccessHeading>
        {t('Return to your terminal to complete your setup.')}
      </SuccessHeading>
    </SuccessWrapper>
  );
}

const SuccessCheckmark = styled(IconCheckmark)`
  flex-shrink: 0;
`;

const SuccessHeading = styled('h5')`
  margin: 0;
`;

const SuccessWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(3)};
`;

export default SetupWizard;
