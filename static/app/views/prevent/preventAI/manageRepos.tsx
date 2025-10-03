import {useEffect, useMemo, useState} from 'react';
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
import ManageReposToolbar from 'sentry/views/prevent/preventAI/manageReposToolbar';

import {FeatureOverview} from './onboarding';

function ManageReposPage({installedOrgs}: {installedOrgs: PreventAIOrg[]}) {
  const theme = useTheme();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState(() => installedOrgs[0]?.id ?? '');
  const [selectedRepo, setSelectedRepo] = useState(
    () => installedOrgs[0]?.repos?.[0]?.id ?? ''
  );

  const selectedOrgData = useMemo(
    () => installedOrgs.find(org => org.id === selectedOrg),
    [installedOrgs, selectedOrg]
  );
  const selectedRepoData = useMemo(
    () => selectedOrgData?.repos?.find(repo => repo.id === selectedRepo),
    [selectedOrgData, selectedRepo]
  );

  // Reset repo selection when org changes
  useEffect(() => {
    const org = installedOrgs.find(o => o.id === selectedOrg);
    if (org && !org.repos.some(repo => repo.id === selectedRepo)) {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setSelectedRepo(org.repos[0]?.id ?? '');
    }
  }, [selectedOrg, installedOrgs, selectedRepo]);

  const isOrgSelected = !!selectedOrgData;
  const isRepoSelected = !!selectedRepoData;

  return (
    <Flex direction="column" maxWidth="1000px" gap="xl">
      <Flex align="center" justify="between">
        <ManageReposToolbar
          installedOrgs={installedOrgs}
          selectedOrg={selectedOrg}
          selectedRepo={selectedRepo}
          onOrgChange={setSelectedOrg}
          onRepoChange={setSelectedRepo}
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
        key={`${selectedOrg || 'no-org'}-${selectedRepo || 'no-repo'}`}
        collapsed={!isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        orgName={selectedOrgData?.name ?? ''}
        repoName={selectedRepoData?.name ?? ''}
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
