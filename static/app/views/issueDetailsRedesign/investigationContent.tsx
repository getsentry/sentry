import styled from '@emotion/styled';

import seerIllustration from 'sentry-images/spot/seer-config-seer.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {LinkedPullRequests} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {useGroupData} from 'sentry/views/issueDetails/groupDataContext';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {IssuePreviewAutofixSummary} from 'sentry/views/issueDetails/issuePreview/issuePreviewAutofixSummary';

/**
 * The Investigation tab reuses the inbox preview's body: linked pull requests,
 * the Seer autofix summary (proposal / implementation / root cause), and the
 * activity feed. It renders inside the redesign page's GroupDataContextProvider,
 * so it reads the current group/project from context. When Seer is unavailable
 * the autofix summary is simply omitted and the tab still shows PRs + activity.
 */
export function InvestigationContent() {
  const {group, project} = useGroupData();
  const {hasAutofix} = useAiConfig(group, project);
  const autofix = useExplorerAutofix(group, {enabled: hasAutofix});

  if (hasAutofix && autofix.isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <Dividers>
      <LinkedPullRequests group={group} showEmptyState={false} />
      {hasAutofix ? (
        <IssuePreviewAutofixSummary runState={autofix.runState} />
      ) : (
        <SeerPromoCard />
      )}
      <Container>
        <ErrorBoundary mini>
          <FoldSection
            title={
              <Heading as="h3" size="md">
                {t('Activity')}
              </Heading>
            }
            sectionKey={SectionKey.ACTIVITY}
          >
            <ActivitySection
              group={group}
              variant="standalone"
              size="md"
              placeholder={t('Add a comment. Tag users with @, or teams with #')}
            />
          </FoldSection>
        </ErrorBoundary>
      </Container>
    </Dividers>
  );
}

function SeerPromoCard() {
  const organization = useOrganization();
  return (
    <Stack border="muted" radius="md" padding="lg" gap="lg">
      <Flex align="center" justify="between" gap="xl">
        <Stack gap="lg">
          <Text bold>{t('Meet Seer, your AI assistant')}</Text>
          <Text>
            {t(
              "Debug faster with Sentry's agent, Seer. Seer connects to your repos, scans your issues, highlights quick fixes, and proposes solutions. You can even integrate with your favorite agent to implement changes in code."
            )}
          </Text>
          <Flex>
            <LinkButton
              to={`/settings/${organization.slug}/billing/overview/?product=seer`}
              icon={<IconOpen />}
            >
              {t('Try out Seer now')}
            </LinkButton>
          </Flex>
        </Stack>
        <SeerIllustration src={seerIllustration} alt="" />
      </Flex>
    </Stack>
  );
}

const Dividers = styled('div')`
  padding: ${p => p.theme.space.md} 0;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  & > * + * {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
    padding-top: ${p => p.theme.space.md};
  }
`;

const SeerIllustration = styled('img')`
  width: 180px;
  flex-shrink: 0;
`;
