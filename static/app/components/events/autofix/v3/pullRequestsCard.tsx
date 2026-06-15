import {useMemo} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

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
import {useIntegration} from 'sentry/utils/integrations/useIntegration';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';
import {getProviderConfigUrl} from 'sentry/views/settings/organizationRepositories/getProviderConfigUrl';

interface PullRequestsCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
}

export function PullRequestsCard({autofix, section}: PullRequestsCardProps) {
  const runId = autofix.runState?.run_id;
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
                variant="primary"
                icon={<IconOpen />}
              >
                {t('View %s#%s', pullRequest.repo_name, pullRequest.pr_number)}
              </LinkButton>
              <Button
                variant="primary"
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
          <RetryPrButton
            key={pullRequest.repo_name}
            autofix={autofix}
            pullRequest={pullRequest}
            runId={runId}
          />
        );
      })}
    </ArtifactCard>
  );
}

interface RetryPrButtonProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  pullRequest: RepoPRState;
  runId: number;
}

function RetryPrButton({autofix, pullRequest, runId}: RetryPrButtonProps) {
  const organization = useOrganization();
  const integration = useIntegration({
    orgSlug: organization.slug,
    integrationId: pullRequest.integration_id ?? undefined,
  });

  const {createPR} = autofix;

  const configureGithubAccessUrl = useMemo(() => {
    const needsWriteAccess =
      pullRequest.pr_creation_status === 'error' &&
      pullRequest.pr_creation_error ===
        `No write access to repository ${pullRequest.repo_name}`;
    if (!needsWriteAccess) {
      return null;
    }

    const data = integration.data;
    if (!data) {
      return null;
    }

    const configUrl = getProviderConfigUrl(data);
    if (!configUrl) {
      return null;
    }

    return `${configUrl}/permissions/update`;
  }, [pullRequest, integration]);

  return (
    <Flex gap="xs" align="center" justify="between">
      <Button
        variant="primary"
        icon={<IconRefresh size="xs" />}
        onClick={() => createPR(runId, pullRequest.repo_name)}
        tooltipProps={{title: pullRequest.pr_creation_error}}
      >
        {t('Retry PR in %s', pullRequest.repo_name)}
      </Button>
      {configureGithubAccessUrl && (
        <ExternalLink href={configureGithubAccessUrl}>
          <Flex as="span" align="center" gap="sm">
            <IconOpen />
            {t('Configure GitHub Access')}
          </Flex>
        </ExternalLink>
      )}
    </Flex>
  );
}
