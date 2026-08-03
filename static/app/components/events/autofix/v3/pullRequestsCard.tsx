import {useMemo} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {getRepoPullRequestLink} from 'sentry/components/events/autofix/pullRequests';
import {
  getAutofixArtifactFromSection,
  isPullRequestsArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactCard} from 'sentry/components/events/autofix/v3/artifactCard';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

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
          return (
            <Button key={pullRequest.repo_name} variant="primary" disabled>
              {pullRequest.pr_number
                ? t('Updating PR in %s', pullRequest.repo_name)
                : t('Creating PR in %s', pullRequest.repo_name)}
            </Button>
          );
        }

        const link = getRepoPullRequestLink(pullRequest);
        if (link) {
          return (
            <Flex key={pullRequest.repo_name} gap="xs" align="center">
              <LinkButton external href={link.url} variant="primary" icon={<IconOpen />}>
                {link.label}
              </LinkButton>
              <Button
                variant="primary"
                icon={<IconCopy size="xs" />}
                aria-label={t('Copy PR URL')}
                tooltipProps={{title: t('Copy PR URL')}}
                onClick={() =>
                  copy(link.url, {
                    successMessage: t('PR URL copied to clipboard.'),
                  })
                }
              />
            </Flex>
          );
        }

        return (
          <Flex key={pullRequest.repo_name} gap="xs" align="center">
            <Button
              variant="primary"
              icon={<IconRefresh size="xs" />}
              onClick={() => createPR(runId, pullRequest.repo_name)}
              tooltipProps={{title: pullRequest.pr_creation_error}}
            >
              {t('Retry PR in %s', pullRequest.repo_name)}
            </Button>
          </Flex>
        );
      })}
    </ArtifactCard>
  );
}
