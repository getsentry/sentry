import {useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  CodingAgentStatus,
  getCodingAgentName,
  getResultButtonLabel,
} from 'sentry/components/events/autofix/types';
import {
  getAutofixArtifactFromSection,
  isCodingAgentsArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactCard} from 'sentry/components/events/autofix/v3/artifactCard';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {IconBot} from 'sentry/icons/iconBot';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t, tct} from 'sentry/locale';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

interface CodingAgentsCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
}

export function CodingAgentsCard({section}: CodingAgentsCardProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isCodingAgentsArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  const {copy} = useCopyToClipboard();
  const markdown = useMemo(
    () => (artifact ? artifactToMarkdown(artifact) : null),
    [artifact]
  );
  const provider = artifact?.[0]?.provider;

  const agentName = useMemo(() => getCodingAgentName(provider), [provider]);

  return (
    <ArtifactCard
      icon={<IconBot />}
      title={agentName}
      onCopy={
        markdown
          ? () => copy(markdown, {successMessage: t('Copied to clipboard.')})
          : undefined
      }
    >
      {artifact?.map(codingAgent => {
        const statusVariant =
          codingAgent.status === CodingAgentStatus.PENDING
            ? ('muted' as const)
            : codingAgent.status === CodingAgentStatus.RUNNING
              ? ('info' as const)
              : codingAgent.status === CodingAgentStatus.FAILED
                ? ('danger' as const)
                : ('success' as const);

        return (
          <ArtifactDetails key={codingAgent.id} direction="column" gap="md">
            <Flex direction="row" justify="between">
              <Flex direction="row" gap="md">
                <Text>{codingAgent.name}</Text>
                <Text variant="muted">
                  {tct('Started [startedAt]', {
                    startedAt: <TimeSince date={codingAgent.started_at} />,
                  })}
                </Text>
              </Flex>
              <Tag variant={statusVariant}>{codingAgent.status}</Tag>
            </Flex>
            <Flex direction="row" gap="md">
              {codingAgent.agent_url ? (
                <LinkButton href={codingAgent.agent_url} external icon={<IconOpen />}>
                  {t('Open in %s', agentName)}
                </LinkButton>
              ) : null}
              {codingAgent.results?.map(result => {
                if (!result.pr_url) {
                  return null;
                }

                return (
                  <LinkButton
                    key={result.pr_url}
                    href={result.pr_url}
                    external
                    icon={<IconOpen />}
                  >
                    {getResultButtonLabel(result.pr_url)}
                  </LinkButton>
                );
              })}
            </Flex>
          </ArtifactDetails>
        );
      })}
    </ArtifactCard>
  );
}
