import {useCallback, useMemo, useState} from 'react';
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
import type {PreventAIOrg} from 'sentry/types/prevent';
import ManageReposPanel from 'sentry/views/prevent/preventAI/manageReposPanel';
import ManageReposToolbar, {
  ALL_REPOS_VALUE,
} from 'sentry/views/prevent/preventAI/manageReposToolbar';

import {FeatureOverview} from './onboarding';

function ManageReposPage({installedOrgs}: {installedOrgs: PreventAIOrg[]}) {
  const theme = useTheme();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [selectedOrgName, setSelectedOrgName] = useState(
    () => installedOrgs[0]?.name ?? ''
  );
  const [selectedRepoName, setSelectedRepoName] = useState(() => ALL_REPOS_VALUE);

  // If the selected org is not present in the list of orgs, use the first org
  const selectedOrg = useMemo(() => {
    const found = installedOrgs.find(org => org.name === selectedOrgName);
    return found ?? installedOrgs[0];
  }, [installedOrgs, selectedOrgName]);

  // Ditto for repos
  const selectedRepo = useMemo(() => {
    if (selectedRepoName === ALL_REPOS_VALUE) {
      return null;
    }
    const found = selectedOrg?.repos?.find(repo => repo.name === selectedRepoName);
    return found ?? selectedOrg?.repos?.[0];
  }, [selectedOrg, selectedRepoName]);

  // When the org changes, if the selected repo is not present in the new org,
  // reset to "All Repos"
  const setSelectedOrgNameWithCascadeRepoName = useCallback(
    (orgName: string) => {
      setSelectedOrgName(orgName);
      const newSelectedOrgData = installedOrgs.find(org => org.name === orgName);
      if (
        newSelectedOrgData &&
        selectedRepoName !== ALL_REPOS_VALUE &&
        !newSelectedOrgData.repos.some(repo => repo.name === selectedRepoName)
      ) {
        setSelectedRepoName(ALL_REPOS_VALUE);
      }
    },
    [installedOrgs, selectedRepoName]
  );

  const isOrgSelected = !!selectedOrg;
  const isRepoSelected = selectedRepoName === ALL_REPOS_VALUE || !!selectedRepo;

  return (
    <Flex direction="column" maxWidth="1000px" gap="xl">
      <Flex align="center" justify="between">
        <ManageReposToolbar
          installedOrgs={installedOrgs}
          selectedOrg={selectedOrgName}
          selectedRepo={selectedRepoName}
          onOrgChange={setSelectedOrgNameWithCascadeRepoName}
          onRepoChange={setSelectedRepoName}
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

      <ManageReposPanel
        key={`${selectedOrgName || 'no-org'}-${selectedRepoName || 'no-repo'}`}
        collapsed={!isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        orgId={selectedOrg?.id ?? ''}
        orgName={selectedOrg?.name ?? ''}
        repoId={selectedRepo?.id ?? ''}
        repoName={selectedRepo?.name ?? ''}
        allRepos={selectedOrg?.repos ?? []}
        isEditingOrgDefaults={selectedRepoName === ALL_REPOS_VALUE}
      />
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
