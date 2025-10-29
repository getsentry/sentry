import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import preventPrCommentsDark from 'sentry-images/features/prevent-pr-comments-dark.svg';
import preventPrCommentsLight from 'sentry-images/features/prevent-pr-comments-light.svg';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {PreventAIOrg} from 'sentry/types/prevent';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useInfiniteRepositories} from 'sentry/views/prevent/preventAI/hooks/useInfiniteRepositories';
import ManageReposPanel from 'sentry/views/prevent/preventAI/manageReposPanel';
import ManageReposToolbar, {
  ALL_REPOS_VALUE,
} from 'sentry/views/prevent/preventAI/manageReposToolbar';

import {FeatureOverview} from './onboarding';

function ManageReposPage(_props: {installedOrgs: PreventAIOrg[]}) {
  const theme = useTheme();
  const organization = useOrganization();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Track if we've initialized from URL params to avoid overriding user selections
  const hasInitializedFromUrlRef = useRef({org: false, repo: false});

  // selectedOrgId now stores the Sentry integration ID (not GitHub org ID)
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedRepoId, setSelectedRepoId] = useState<string>(() => ALL_REPOS_VALUE);

  // Fetch GitHub integrations to get organization names
  const {data: githubIntegrations = []} = useApiQuery<OrganizationIntegration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {
      staleTime: 0,
    }
  );

  // Fetch repositories for the selected organization using infinite scroll
  const {data: reposData = []} = useInfiniteRepositories({
    integrationId: selectedOrgId,
    term: undefined, // No search term for the panel
  });

  // Find the selected org and repo data
  const selectedOrgData = useMemo(
    () => githubIntegrations.find(integration => integration.id === selectedOrgId),
    [githubIntegrations, selectedOrgId]
  );

  const selectedRepoData = useMemo(
    () => reposData.find(repo => repo.id === selectedRepoId),
    [reposData, selectedRepoId]
  );

  // Initialize from URL params when data is loaded, or auto-select first org
  useEffect(() => {
    const org = searchParams.get('org');
    const repo = searchParams.get('repo');

    // Find org by name if specified in URL
    if (
      org &&
      githubIntegrations.length > 0 &&
      !selectedOrgId &&
      !hasInitializedFromUrlRef.current.org
    ) {
      const matchedOrg = githubIntegrations.find(
        integration => integration.name.toLowerCase() === org.toLowerCase()
      );
      if (matchedOrg) {
        setSelectedOrgId(matchedOrg.id);
        hasInitializedFromUrlRef.current.org = true;
      }
    }
    // Auto-select first org if no URL param and not yet initialized
    else if (
      !org &&
      githubIntegrations.length > 0 &&
      !selectedOrgId &&
      !hasInitializedFromUrlRef.current.org &&
      githubIntegrations[0]
    ) {
      setSelectedOrgId(githubIntegrations[0].id);
      hasInitializedFromUrlRef.current.org = true;
    }

    // Find repo by name if specified in URL (only after org is selected and repos are loaded)
    if (
      repo &&
      selectedOrgId &&
      reposData.length > 0 &&
      !hasInitializedFromUrlRef.current.repo
    ) {
      const matchedRepo = reposData.find(r => {
        const repoNameWithoutOrg = r.name.includes('/')
          ? r.name.split('/').pop() || r.name
          : r.name;
        return repoNameWithoutOrg.toLowerCase() === repo.toLowerCase();
      });
      if (matchedRepo) {
        setSelectedRepoId(matchedRepo.id);
        hasInitializedFromUrlRef.current.repo = true;
      }
    }
  }, [searchParams, githubIntegrations, reposData, selectedOrgId]);

  // When the org changes, reset to "All Repos" to avoid stale repo selection
  const setSelectedOrgIdWithCascadeRepoId = useCallback(
    (integrationId: string) => {
      setSelectedOrgId(integrationId);
      // Reset to All Repos when changing organizations
      setSelectedRepoId(ALL_REPOS_VALUE);
      // Reset initialization flags when user manually changes org
      hasInitializedFromUrlRef.current = {org: true, repo: false};

      // Update URL params with org name
      const selectedOrg = githubIntegrations.find(
        integration => integration.id === integrationId
      );
      if (selectedOrg) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('org', selectedOrg.name);
        newParams.delete('repo'); // Clear repo when changing org
        setSearchParams(newParams);
      }
    },
    [githubIntegrations, searchParams, setSearchParams]
  );

  // Update URL params when repo changes
  const setSelectedRepoIdWithUrlUpdate = useCallback(
    (repoId: string) => {
      setSelectedRepoId(repoId);
      // Mark repo as initialized when user manually changes it
      hasInitializedFromUrlRef.current.repo = true;

      const newParams = new URLSearchParams(searchParams);
      if (repoId === ALL_REPOS_VALUE) {
        newParams.delete('repo');
      } else {
        const selectedRepo = reposData.find(r => r.id === repoId);
        if (selectedRepo) {
          const repoNameWithoutOrg = selectedRepo.name.includes('/')
            ? selectedRepo.name.split('/').pop() || selectedRepo.name
            : selectedRepo.name;
          newParams.set('repo', repoNameWithoutOrg);
        }
      }
      setSearchParams(newParams);
    },
    [reposData, searchParams, setSearchParams]
  );

  const isOrgSelected = !!selectedOrgId;
  const isRepoSelected = !!selectedRepoId;

  return (
    <Flex direction="column" maxWidth="1000px" gap="xl">
      <Flex align="center" justify="between">
        <ManageReposToolbar
          selectedOrg={selectedOrgId}
          selectedRepo={selectedRepoId}
          onOrgChange={setSelectedOrgIdWithCascadeRepoId}
          onRepoChange={setSelectedRepoIdWithUrlUpdate}
        />
        <Flex style={{transform: 'translateY(-70px)'}}>
          <Tooltip
            title="Select an organization and repository to configure settings"
            disabled={isOrgSelected && isRepoSelected}
            position="left"
          >
            <Button
              borderless
              icon={<IconSettings size="md" />}
              aria-label="Settings"
              onClick={() => setIsPanelOpen(true)}
              disabled={!isOrgSelected || !isRepoSelected}
              tabIndex={!isOrgSelected || !isRepoSelected ? -1 : 0}
              data-test-id="manage-repos-settings-button"
            />
          </Tooltip>
        </Flex>
      </Flex>

      <Flex
        direction="row"
        gap="md"
        border="muted"
        radius="md"
        padding="xl 2xl"
        maxWidth="1000px"
      >
        <Flex direction="column" gap="md" maxWidth="600px" padding="md">
          <Text
            style={{
              borderBottom: `1px solid ${theme.border}`,
              marginBottom: theme.space.xl,
              paddingBottom: theme.space['2xl'],
            }}
          >
            <Heading
              as="h1"
              data-test-id="manage-repos-title"
              style={{marginBottom: theme.space.xs}}
            >
              {t('Manage Repositories')}
            </Heading>
            <Text>
              {tct(
                `To install more repositories or uninstall the app, go to your [link:Seer by Sentry app] on GitHub.`,
                {
                  link: (
                    <ExternalLink
                      href="https://github.com/apps/seer-by-sentry"
                      data-test-id="manage-repos-external-link"
                    />
                  ),
                }
              )}
            </Text>
          </Text>
          <FeatureOverview />
        </Flex>

        <StyledImg
          src={theme.type === 'dark' ? preventPrCommentsDark : preventPrCommentsLight}
          alt="Prevent PR Comments"
          data-test-id="manage-repos-illustration-image"
        />
      </Flex>

      {isPanelOpen && selectedOrgData && (
        <ManageReposPanel
          key={`${selectedOrgId || 'no-org'}-${selectedRepoId || 'no-repo'}`}
          collapsed={!isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          org={{
            githubOrganizationId: selectedOrgData.externalId || selectedOrgId,
            name: selectedOrgData.name,
            provider: 'github' as const,
            repos: reposData.map(repo => {
              // Extract just the repo name without org prefix
              const repoNameWithoutOrg = repo.name.includes('/')
                ? repo.name.split('/').pop() || repo.name
                : repo.name;
              return {
                id: repo.id,
                name: repoNameWithoutOrg,
                fullName: repo.name,
              };
            }),
          }}
          repo={
            selectedRepoId === ALL_REPOS_VALUE || !selectedRepoData
              ? null
              : {
                  id: selectedRepoData.id,
                  name: selectedRepoData.name.includes('/')
                    ? selectedRepoData.name.split('/').pop() || selectedRepoData.name
                    : selectedRepoData.name,
                  fullName: selectedRepoData.name,
                }
          }
          allRepos={reposData.map(repo => {
            const repoNameWithoutOrg = repo.name.includes('/')
              ? repo.name.split('/').pop() || repo.name
              : repo.name;
            return {
              id: repo.id,
              name: repoNameWithoutOrg,
              fullName: repo.name,
            };
          })}
          isEditingOrgDefaults={selectedRepoId === ALL_REPOS_VALUE}
        />
      )}
    </Flex>
  );
}

const StyledImg = styled('img')`
  overflow: hidden;
  max-width: 40%;
  align-self: center;
  padding: ${p => p.theme.space['2xl']};
`;

export default ManageReposPage;
