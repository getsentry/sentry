import {useState} from 'react';
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
import RepoSettingsPanel from 'sentry/views/prevent/preventAI/manageReposPanel';
import ManageReposToolbar from 'sentry/views/prevent/preventAI/manageReposToolbar';
import type {IntegrationOrg} from 'sentry/views/prevent/preventAI/usePreventAIOrgRepos';

import {FeatureOverview} from './onboarding';

export default function PreventAIManageRepos({
  installedOrgs,
}: {
  installedOrgs: IntegrationOrg[];
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const theme = useTheme();

  return (
    <Flex direction="column" gap="2xl">
      <ManageReposToolbar installedOrgs={installedOrgs} setIsPanelOpen={setIsPanelOpen} />
      <Flex
        direction="row"
        gap="md"
        border="primary"
        radius="md"
        padding="xl 2xl"
        maxWidth="1000px"
      >
        <Flex direction="column" gap="2xl" maxWidth="600px">
          <Flex
            direction="column"
            gap="lg"
            padding="0 0 xl 0"
            style={{borderBottom: `1px solid ${theme.border}`}}
          >
            <Heading as="h1">{t('Manage Repositories')}</Heading>
            <Text variant="primary" size="md">
              {tct(
                `To install more repositories or uninstall the app, go to your [link:Seer by Sentry app] on GitHub.`,
                {
                  link: <ExternalLink href="https://github.com/apps/seer-by-sentry" />,
                }
              )}
            </Text>
          </Flex>
          <FeatureOverview />
          <RepoSettingsPanel
            collapsed={!isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
          />
        </Flex>
        <StyledImg
          src={theme.type === 'dark' ? preventPrCommentsDark : preventPrCommentsLight}
          alt="Prevent PR Comments"
        />
      </Flex>
    </Flex>
  );
}

const StyledImg = styled('img')`
  overflow: hidden;
  height: 100%;
  max-width: 40%;
  align-self: center;
`;
