import {useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import preventPrCommentsDark from 'sentry-images/features/prevent-pr-comments-dark.svg';
import preventPrCommentsLight from 'sentry-images/features/prevent-pr-comments-light.svg';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {OrganizationIntegration, Repository} from 'sentry/types/integrations';
import {useInfiniteRepositories} from 'sentry/views/prevent/preventAI/hooks/usePreventAIInfiniteRepositories';
import ManageReposPanel from 'sentry/views/prevent/preventAI/manageReposPanel';
import ManageReposToolbar from 'sentry/views/prevent/preventAI/manageReposToolbar';

import {FeatureOverview} from './onboarding';

function ManageReposPage({integratedOrgs}: {integratedOrgs: OrganizationIntegration[]}) {
  const theme = useTheme();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    () => integratedOrgs[0]?.id ?? ''
  );
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(() => null);

  const queryResult = useInfiniteRepositories({
    integrationId: selectedOrgId,
    searchTerm: undefined,
  });
  const reposData = useMemo(
    () => uniqBy(queryResult.data?.pages.flatMap(result => result[0]) ?? [], 'id'),
    [queryResult.data?.pages]
  );

  // If the selected org is not present in the list of orgs, use the first org
  const selectedOrg = useMemo(() => {
    const found = integratedOrgs.find(org => org.id === selectedOrgId);
    return found ?? integratedOrgs[0];
  }, [integratedOrgs, selectedOrgId]);

  // When the org changes, reset to "All Repos"
  const setSelectedOrgIdWithCascadeRepoId = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    setSelectedRepo(null);
  }, []);

  const isOrgSelected = !!selectedOrg;

  return (
    <Flex direction="column" maxWidth="1000px" gap="xl">
      <Flex align="center" justify="between">
        <ManageReposToolbar
          integratedOrgs={integratedOrgs}
          selectedOrg={selectedOrgId}
          selectedRepo={selectedRepo}
          onOrgChange={setSelectedOrgIdWithCascadeRepoId}
          onRepoChange={setSelectedRepo}
        />
        <Flex style={{transform: 'translateY(-70px)'}}>
          <Tooltip
            title="Select an organization and repository to configure settings"
            disabled={isOrgSelected}
            position="left"
          >
            <Button
              borderless
              icon={<IconSettings size="md" />}
              aria-label="Settings"
              onClick={() => setIsPanelOpen(true)}
              disabled={!isOrgSelected}
              tabIndex={isOrgSelected ? 0 : -1}
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

      {selectedOrg && (
        <ManageReposPanel
          key={`${selectedOrgId || 'no-org'}-${selectedRepo?.externalId || 'all-repos'}`}
          collapsed={!isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          org={selectedOrg}
          repo={selectedRepo}
          allRepos={reposData}
          isEditingOrgDefaults={selectedRepo === null}
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
