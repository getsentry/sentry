import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import preventPrCommentsDark from 'sentry-images/features/prevent-pr-comments-dark.png';
import preventPrCommentsLight from 'sentry-images/features/prevent-pr-comments-light.png';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ManageReposPanel from 'sentry/views/prevent/preventAI/manageReposPanel';
import ManageReposToolbar from 'sentry/views/prevent/preventAI/manageReposToolbar';
import type {PreventAIOrg} from 'sentry/views/prevent/preventAI/types';

import {FeatureOverview} from './onboarding';

export default function PreventAIManageRepos({
  installedOrgs,
}: {
  installedOrgs: PreventAIOrg[];
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(() => installedOrgs[0]?.id ?? '');
  const [selectedRepo, setSelectedRepo] = useState(
    () => installedOrgs[0]?.repos?.[0]?.id ?? ''
  );
  const theme = useTheme();

  // Get the selected org and repo names for display
  const selectedOrgData = installedOrgs.find(org => org.id === selectedOrg);
  const selectedRepoData = selectedOrgData?.repos?.find(repo => repo.id === selectedRepo);

  // Reset repo selection when org changes
  useEffect(() => {
    const org = installedOrgs.find(o => o.id === selectedOrg);
    if (org && !org.repos.some(repo => repo.id === selectedRepo)) {
      setSelectedRepo(org.repos[0]?.id ?? '');
    }
  }, [selectedOrg, installedOrgs, selectedRepo]);

  return (
    <ManageReposContainer>
      <ManageReposHeader>
        <ManageReposToolbar
          installedOrgs={installedOrgs}
          selectedOrg={selectedOrg}
          selectedRepo={selectedRepo}
          onOrgChange={setSelectedOrg}
          onRepoChange={setSelectedRepo}
        />
        <SettingsButton
          borderless
          icon={<IconSettings size="md" />}
          aria-label="Settings"
          onClick={() => setIsPanelOpen(true)}
        />
      </ManageReposHeader>
      <ManageReposMainContent>
        <ManageReposLeft>
          <ManageReposLeftTitleBlock>
            <ManageReposLeftTitle as="h1">
              {t('Manage Repositories')}
            </ManageReposLeftTitle>
            <Text>
              {tct(
                `To install more repositories or uninstall the app, go to your [link:Seer by Sentry app] on GitHub.`,
                {
                  link: <ExternalLink href="https://github.com/apps/seer-by-sentry" />,
                }
              )}
            </Text>
          </ManageReposLeftTitleBlock>
          <FeatureOverview />
          <ManageReposPanel
            collapsed={!isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            orgName={selectedOrgData?.name || 'Select Organization'}
            repoName={selectedRepoData?.name || 'Select Repository'}
          />
        </ManageReposLeft>

        <StyledImg
          src={theme.type === 'dark' ? preventPrCommentsDark : preventPrCommentsLight}
          alt="Prevent PR Comments"
        />
      </ManageReposMainContent>
    </ManageReposContainer>
  );
}

const ManageReposContainer = styled(Flex)`
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  max-width: 1000px;
`;

const ManageReposHeader = styled(Flex)`
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${p => p.theme.space.sm};
`;

const SettingsButton = styled(Button)`
  transform: translateY(-70px);
`;

const ManageReposMainContent = styled(Flex)`
  flex-direction: row;
  gap: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => `${p.theme.space.xl} ${p.theme.space['2xl']}`};
  max-width: 1000px;
`;

const ManageReposLeft = styled(Flex)`
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  max-width: 600px;
  padding: ${p => p.theme.space.md};
`;

const ManageReposLeftTitleBlock = styled(Text)`
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: ${p => p.theme.space.xl};
  padding-bottom: ${p => p.theme.space['2xl']};
`;

const ManageReposLeftTitle = styled(Heading)`
  margin-bottom: ${p => p.theme.space.xs};
`;

const StyledImg = styled('img')`
  overflow: hidden;
  max-width: 40%;
  align-self: center;
  padding: ${p => p.theme.space['2xl']};
`;
