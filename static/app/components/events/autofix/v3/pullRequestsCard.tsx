import {useMemo} from 'react';
import {IconCopy} from '@sentry/icons/copy';
import {IconOpen} from '@sentry/icons/open';
import {IconPullRequest} from '@sentry/icons/pullRequest';
import {IconRefresh} from '@sentry/icons/refresh';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {getRepoPullRequestLink} from 'sentry/components/events/autofix/pullRequests';
import {
  getAutofixArtifactFromSection,
  isPullRequestsArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  getOutOfCreditsPRMessage,
  getOutOfCreditsPRsMessage,
} from 'sentry/components/seer/outOfCredits/messages';
import {useOutOfCreditsRetry} from 'sentry/components/seer/outOfCredits/useOutOfCreditsRetry';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {isOutOfCreditsPRState} from 'sentry/views/seerExplorer/types';

import {ArtifactCard} from './artifactCard';
import {artifactToMarkdown} from './utils';

interface PullRequestsCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
}

export function PullRequestsCard({autofix, section}: PullRequestsCardProps) {
  const runId = getAutofixRunId(autofix.runState);
  const {createPR} = autofix;
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isPullRequestsArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);
  const {copy} = useCopyToClipboard();
  const markdown = useMemo(
    () => (artifact ? artifactToMarkdown(artifact) : null),
    [artifact]
  );

  const outOfCreditsPullRequests = artifact?.filter(isOutOfCreditsPRState) ?? [];
  // Their "Retry PR" fails the same way until the organization can afford it.
  const outOfCreditsRetry = useOutOfCreditsRetry('autofix_create_pr', {
    enabled: defined(runId) && outOfCreditsPullRequests.length > 0,
  });

  if (!runId) {
    return null;
  }

  return (
    <ArtifactCard
      icon={<IconPullRequest />}
      title={t('Pull Requests')}
      onCopy={
        markdown
          ? () => copy(markdown, {successMessage: t('Copied to clipboard.')})
          : undefined
      }
    >
      {artifact?.map(pullRequest => {
        if (pullRequest.pr_creation_status === 'creating') {
          const isUpdating = defined(pullRequest.pr_number);
          return (
            <Flex key={pullRequest.repo_name} gap="xs" align="center">
              <Button variant="primary" disabled>
                {isUpdating
                  ? t('Updating PR in %s', pullRequest.repo_name)
                  : t('Creating PR in %s', pullRequest.repo_name)}
              </Button>
              {isUpdating && pullRequest.pr_url && (
                <CopyPullRequestUrlButton url={pullRequest.pr_url} />
              )}
            </Flex>
          );
        }

        const link = getRepoPullRequestLink(pullRequest);
        if (link) {
          return (
            <Flex key={pullRequest.repo_name} gap="xs" align="center">
              <LinkButton external href={link.url} variant="primary" icon={<IconOpen />}>
                {link.label}
              </LinkButton>
              <CopyPullRequestUrlButton url={link.url} />
            </Flex>
          );
        }

        const isOutOfCredits = isOutOfCreditsPRState(pullRequest);
        return (
          <Flex key={pullRequest.repo_name} gap="xs" align="center">
            <Button
              variant="primary"
              icon={<IconRefresh size="xs" />}
              onClick={() => createPR(runId, pullRequest.repo_name)}
              disabled={isOutOfCredits && outOfCreditsRetry.disabled}
              tooltipProps={{
                title: isOutOfCredits
                  ? (outOfCreditsRetry.tooltip ?? getOutOfCreditsPRMessage(pullRequest))
                  : pullRequest.pr_creation_error,
              }}
            >
              {t('Retry PR in %s', pullRequest.repo_name)}
            </Button>
          </Flex>
        );
      })}
      {outOfCreditsPullRequests.length > 0 && (
        <Text variant="muted">{getOutOfCreditsPRsMessage(outOfCreditsPullRequests)}</Text>
      )}
    </ArtifactCard>
  );
}

function CopyPullRequestUrlButton({url}: {url: string}) {
  const {copy} = useCopyToClipboard();

  return (
    <Button
      variant="primary"
      icon={<IconCopy size="xs" />}
      aria-label={t('Copy PR URL')}
      tooltipProps={{title: t('Copy PR URL')}}
      onClick={() => copy(url, {successMessage: t('PR URL copied to clipboard.')})}
    />
  );
}
