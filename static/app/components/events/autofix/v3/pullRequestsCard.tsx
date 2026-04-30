import {useMemo} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isPullRequestsArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);
  const {copy} = useCopyToClipboard();
  const markdown = useMemo(
    () => (artifact ? artifactToMarkdown(artifact) : null),
    [artifact]
  );

  const runId = autofix.runState?.run_id;

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
            <Button key={pullRequest.repo_name} priority="primary" disabled>
              {t('Creating PR in %s', pullRequest.repo_name)}
            </Button>
          );
        }

        if (
          pullRequest.pr_creation_status === 'completed' &&
          pullRequest.pr_url &&
          pullRequest.pr_number
        ) {
          return (
            <Flex key={pullRequest.repo_name} gap="xs" align="center">
              <LinkButton
                external
                href={pullRequest.pr_url}
                priority="primary"
                icon={<IconOpen />}
              >
                {t('View %s#%s', pullRequest.repo_name, pullRequest.pr_number)}
              </LinkButton>
              <Button
                priority="primary"
                icon={<IconCopy size="xs" />}
                aria-label={t('Copy PR URL')}
                tooltipProps={{title: t('Copy PR URL')}}
                onClick={() =>
                  copy(pullRequest.pr_url!, {
                    successMessage: t('PR URL copied to clipboard.'),
                  })
                }
              />
            </Flex>
          );
        }

        return (
          <Flex key={pullRequest.repo_name} direction="column" gap="sm">
            {pullRequest.pr_creation_error ? (
              <Text variant="danger" size="sm">
                {pullRequest.pr_creation_error}
              </Text>
            ) : (
              <Text variant="muted" size="sm">
                {t('PR creation failed for %s.', pullRequest.repo_name)}
              </Text>
            )}
            {runId !== undefined ? (
              <Button
                priority="primary"
                icon={<IconRefresh size="xs" />}
                onClick={() => autofix.createPR(runId, pullRequest.repo_name)}
                disabled={autofix.isPolling}
              >
                {t('Try again')}
              </Button>
            ) : (
              <Button priority="primary" disabled>
                {t('Failed to create PR in %s', pullRequest.repo_name)}
              </Button>
            )}
          </Flex>
        );
      })}
    </ArtifactCard>
  );
}
