import {createContext, useContext, type ReactNode} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getRepoPullRequestLink} from 'sentry/components/events/autofix/pullRequests';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t} from 'sentry/locale';
import type {RepoPRState} from 'sentry/views/seerExplorer/types';

/**
 * The run's per-repository PR state, supplied by the host that already polls the run.
 * The card reads it from here instead of fetching on its own: the explorer polls the
 * session every 500ms while a push is in flight, so a second poller per card would only
 * add load and could disagree with the header widget.
 */
const SeerRepoPRStatesContext = createContext<Record<string, RepoPRState> | null>(null);

export function SeerRepoPRStatesProvider({
  children,
  repoPRStates,
}: {
  children: ReactNode;
  repoPRStates: Record<string, RepoPRState> | null | undefined;
}) {
  return (
    <SeerRepoPRStatesContext.Provider value={repoPRStates ?? null}>
      {children}
    </SeerRepoPRStatesContext.Provider>
  );
}

export const PullRequestRefEmbed = defineSeerEmbed({
  name: 'pullRequestRef',
  render(props) {
    return <PullRequestRefContent {...props} />;
  },
});

interface PullRequestLink {
  label: string;
  url: string;
}

/**
 * Seer emits the card before the PR exists, so the body carries the PR only when the
 * push updates one that is already open. The live state wins whenever the host has it;
 * the body is what keeps an old conversation's card linked once the host stops polling.
 */
function resolveLink(
  state: RepoPRState | undefined,
  {repoName, prNumber, prUrl}: EmbedOutput<'pullRequestRef'>
): PullRequestLink | null {
  const live = state ? getRepoPullRequestLink(state) : null;
  if (live) {
    return live;
  }
  if (prUrl && prNumber) {
    return {label: t('View %s#%s', repoName, prNumber), url: prUrl};
  }
  return null;
}

function PullRequestRefContent(props: EmbedOutput<'pullRequestRef'>) {
  const {repoName, prNumber, title} = props;
  const repoPRStates = useContext(SeerRepoPRStatesContext);
  const state = repoPRStates?.[repoName];
  const link = resolveLink(state, props);
  const displayTitle = state?.title ?? title;
  const targetNumber = state?.pr_number ?? prNumber;

  let body: ReactNode;
  if (state?.pr_creation_status === 'creating') {
    body = (
      <Flex gap="md" align="center">
        <LoadingIndicator size={16} style={{margin: 0}} />
        <Text variant="muted" size="sm">
          {targetNumber
            ? t('Pushing changes to %s#%s…', repoName, targetNumber)
            : t('Opening a pull request in %s…', repoName)}
        </Text>
      </Flex>
    );
  } else if (state?.pr_creation_status === 'error') {
    body = (
      <Stack gap="2xs">
        <Text variant="danger" size="sm">
          {t('Seer could not push to %s.', repoName)}
        </Text>
        {state.pr_creation_error && (
          <Text variant="muted" size="sm">
            {state.pr_creation_error}
          </Text>
        )}
      </Stack>
    );
  } else if (link) {
    body = (
      <Flex>
        <LinkButton size="sm" icon={<IconOpen />} href={link.url} external>
          {link.label}
        </LinkButton>
      </Flex>
    );
  } else {
    body = (
      <Text variant="muted" size="sm">
        {t('Waiting for the pull request in %s…', repoName)}
      </Text>
    );
  }

  return (
    <Container
      data-test-id="pull-request-ref-embed"
      width="fit-content"
      maxWidth="100%"
      padding="md"
      border="primary"
      radius="md"
      background="secondary"
    >
      <Flex gap="md" align="start">
        <IconPullRequest size="sm" />
        <Stack gap="sm">
          <Stack gap="2xs">
            <Text bold size="sm">
              {repoName}
            </Text>
            {displayTitle && (
              <Text variant="muted" size="sm">
                {displayTitle}
              </Text>
            )}
          </Stack>
          {body}
        </Stack>
      </Flex>
    </Container>
  );
}
