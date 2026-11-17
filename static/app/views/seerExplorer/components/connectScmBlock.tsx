import {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTimeout} from 'sentry/utils/useTimeout';
import type {
  ConnectScmData,
  PendingUserInput,
  RespondToUserInputOptions,
} from 'sentry/views/seerExplorer/types';

// The fix usually lands a few seconds after the user makes it (a webhook, then a sync job), and
// the slowest normal path (a sync retrying) takes about 6 minutes. After that it stops, and only
// coming back to the tab or pressing Check again checks again.
const POLL_INTERVAL_MS = 5_000;
const POLL_FOR_MS = 10 * 60_000;

interface RepoAccess {
  connectedAccounts: string[];
  /**
   * `found` when Seer can open the repo, `unknown` when Sentry can't say why it can't, or the
   * reason it can't.
   */
  status: string;
}

/**
 * Whether Seer can open the repo now. Seer never pauses for a name that matches more than one
 * repo (it tells the agent instead), so the popup counts that as found and offers Continue.
 */
// TODO(joey): Handle `repo_ambiguous` properly, e.g. by saying the name matches more than one
// repo and asking the user which one, instead of counting it as found.
function isFound(status: string) {
  return status === 'found' || status === 'repo_ambiguous';
}

/** Whether checking again can't help: Seer can open the repo, or Sentry can't say why not. */
function isSettled(status: string) {
  return isFound(status) || status === 'unknown';
}

/**
 * What's stopping Seer from opening the repo, and where to go to fix it. Null when nothing
 * Sentry can name is, so Continue is the way forward.
 */
function getProblem(
  access: RepoAccess,
  orgSlug: string
): {body: string; fix: {label: string; to: string}} | null {
  const integrationsPath = `/settings/${orgSlug}/integrations/?category=source%20code%20management`;

  if (isFound(access.status)) {
    return null;
  }
  switch (access.status) {
    case 'unknown':
      return null;
    case 'no_scm_integration':
      return {
        body: t('No source control is connected to this organization.'),
        fix: {label: t('Connect source control'), to: integrationsPath},
      };
    case 'scm_account_not_connected':
      return {
        body: access.connectedAccounts.length
          ? t(
              "This repo's account isn't connected to this organization. Connected: %s.",
              access.connectedAccounts.join(', ')
            )
          : t("This repo's account isn't connected to this organization."),
        fix: {label: t('Go to integrations'), to: integrationsPath},
      };
    case 'repo_not_in_sentry':
      return {
        body: t(
          "This repo isn't in Sentry. Check its name, and that Sentry has access to it."
        ),
        fix: {label: t('Go to repositories'), to: `/settings/${orgSlug}/repos/`},
      };
    default:
      return {
        body: t("Seer couldn't open this repo."),
        fix: {label: t('Go to integrations'), to: integrationsPath},
      };
  }
}

function CorrectRepoForm({
  repoName,
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (repoName: string) => void;
  repoName: string;
}) {
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        const name = new FormData(event.currentTarget).get('repo_name');
        if (typeof name === 'string' && name.trim()) {
          onSubmit(name.trim());
        }
      }}
    >
      <Stack gap="sm">
        <Input
          aria-label={t('Repository name')}
          defaultValue={repoName}
          name="repo_name"
          required
          size="sm"
        />
        <Stack gap="sm" align="start">
          <Button size="sm" type="submit" variant="primary">
            {t('Try again')}
          </Button>
          <Button size="sm" onClick={onCancel}>
            {t('Cancel')}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

interface ConnectScmBlockProps {
  pendingInput: PendingUserInput;
  respondToUserInput: (
    inputId: string,
    responseData?: Record<string, unknown>,
    options?: RespondToUserInputOptions
  ) => void;
}

/**
 * The prompt above the composer while a run waits on a repo it couldn't open. What it shows
 * comes from Sentry's answer to "can Seer open this repo now?", which it checks until the answer
 * is yes. Until this pause's first answer it shows that it's checking, and if checking fails,
 * it shows the run's error. The run resumes on one of its actions or on the user's next message.
 */
export function ConnectScmBlock({
  pendingInput,
  respondToUserInput,
}: ConnectScmBlockProps) {
  const data = pendingInput.data as ConnectScmData;
  const organization = useOrganization();
  // Whether the field to correct the repo name is open. A later request remounts the block, so
  // it starts closed.
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [shownAt] = useState(() => Date.now());
  // The cache can hold an answer from an earlier pause for this repo, which this pause's failure
  // may contradict, so only answers from after this one opened count.
  const isCurrent = (dataUpdatedAt: number) => dataUpdatedAt >= shownAt;
  // Whether to keep checking: for POLL_FOR_MS after the popup opens.
  const [isWatching, setIsWatching] = useState(true);
  const {start: startWatching} = useTimeout({
    timeMs: POLL_FOR_MS,
    onTimeout: () => setIsWatching(false),
  });
  const {
    data: latestAccess,
    dataUpdatedAt,
    errorUpdatedAt,
    isError,
    refetch,
  } = useQuery({
    ...apiOptions.as<RepoAccess>()(
      '/organizations/$organizationIdOrSlug/seer/repo-access/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {repoName: data.repo_name},
        staleTime: 0,
      }
    ),
    // The fix happens in another tab, so coming back to this one is when to check again.
    refetchOnWindowFocus: true,
    // A failed check would otherwise retry for several seconds before the popup could show the
    // run's error and its buttons. The next poll checks again anyway.
    retry: false,
    refetchInterval: query => {
      const status = isCurrent(query.state.dataUpdatedAt)
        ? query.state.data?.json.status
        : undefined;
      if (!isWatching || (status && isSettled(status))) {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    startWatching();
  }, [startWatching]);

  const checkedAccess = isCurrent(dataUpdatedAt) ? latestAccess : undefined;
  const checkFailed = isError && isCurrent(errorUpdatedAt);
  // No answer for this pause yet, so whatever was wrong may already be fixed.
  const isChecking = !checkedAccess && !checkFailed;
  const access: RepoAccess = checkedAccess ?? {
    status: data.failure_reason,
    connectedAccounts: [],
  };
  const problem = getProblem(access, organization.slug);
  const found = isFound(access.status);
  const stoppedWatching = !isWatching && !isSettled(access.status);

  if (isChecking) {
    return (
      <Container padding="0 xl">
        <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}>
          <Alert variant="muted">
            <Stack gap="lg">
              <Stack gap="xs">
                <Text bold>
                  {t('Checking whether Seer can access %s', data.repo_name)}
                </Text>
                <Placeholder height="1em" width="80%" testId="repo-access-checking" />
              </Stack>
              <Placeholder height="28px" width="160px" />
            </Stack>
          </Alert>
        </motion.div>
      </Container>
    );
  }

  return (
    <Container padding="0 xl">
      <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}>
        <Alert variant={found ? 'success' : 'warning'}>
          <Stack gap="lg">
            <Stack gap="xs">
              <Text bold>
                {found
                  ? t('Perfect, Seer can access %s', data.repo_name)
                  : t("Seer can't access %s", data.repo_name)}
              </Text>
              <Text size="sm">
                {problem?.body ??
                  (found
                    ? t('Continue and Seer will try again.')
                    : t(
                        "Sentry can't tell what's wrong. Check the repo name, or continue and Seer will try again."
                      ))}
              </Text>
              {stoppedWatching && (
                <Text size="sm" variant="muted">
                  {t('Stopped checking every few seconds.')}
                </Text>
              )}
            </Stack>
            {isCorrecting ? (
              <CorrectRepoForm
                repoName={data.repo_name}
                onCancel={() => setIsCorrecting(false)}
                onSubmit={repoName => {
                  setIsCorrecting(false);
                  respondToUserInput(pendingInput.id, {
                    decision: 'correct_repo',
                    repo_name: repoName,
                  });
                }}
              />
            ) : (
              // The first button is the way forward: where to fix it, or Continue once fixed.
              <Stack gap="sm" align="start">
                {problem ? (
                  <LinkButton
                    to={problem.fix.to}
                    openInNewTab
                    size="sm"
                    variant="primary"
                  >
                    {problem.fix.label}
                  </LinkButton>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      respondToUserInput(pendingInput.id, {decision: 'retry'})
                    }
                  >
                    {t('Continue')}
                  </Button>
                )}
                {stoppedWatching && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsWatching(true);
                      startWatching();
                      refetch();
                    }}
                  >
                    {t('Check again')}
                  </Button>
                )}
                <Button size="sm" onClick={() => setIsCorrecting(true)}>
                  {t('Correct repo name')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => respondToUserInput(pendingInput.id, {decision: 'skip'})}
                >
                  {t('Continue without code')}
                </Button>
              </Stack>
            )}
          </Stack>
        </Alert>
      </motion.div>
    </Container>
  );
}
