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

/** A button that opens where to fix the problem in a new tab, or one that acts here. */
type PromptAction = {label: string; to: string} | {label: string; onClick: () => void};

/** What the popup says. Every version has the same layout. */
interface Prompt {
  /**
   * The buttons before Correct repo name and Continue without code. The first is the way
   * forward: Check again when it couldn't check, where to fix the problem, or Continue once
   * there's nothing to fix.
   */
  actions: PromptAction[];
  /** Null while it's checking, when placeholders stand in for the text and the buttons. */
  body: string | null;
  title: string;
  variant: 'muted' | 'success' | 'warning';
  note?: string;
}

/** What to say, given this pause's latest answer (if any) and whether it's still checking. */
function getPrompt({
  access,
  isWatching,
  repoName,
  orgSlug,
  onCheckAgain,
  onContinue,
}: {
  access: RepoAccess | undefined;
  isWatching: boolean;
  onCheckAgain: () => void;
  onContinue: () => void;
  orgSlug: string;
  repoName: string;
}): Prompt {
  const checkAgain = {label: t('Check again'), onClick: onCheckAgain};
  const continueRun = {label: t('Continue'), onClick: onContinue};

  if (!access) {
    // No answer for this pause yet, so whatever was wrong may already be fixed. That holds while
    // checks fail too: a failure says nothing about the repo.
    if (isWatching) {
      return {
        title: t('Checking whether Seer can access %s', repoName),
        variant: 'muted',
        body: null,
        actions: [],
      };
    }
    return {
      title: t("Couldn't check whether Seer can access %s", repoName),
      variant: 'warning',
      body: t('Check again, or continue and Seer will try again.'),
      actions: [checkAgain, continueRun],
    };
  }

  if (isFound(access.status)) {
    return {
      title: t('Perfect, Seer can access %s', repoName),
      variant: 'success',
      body: t('Continue and Seer will try again.'),
      actions: [continueRun],
    };
  }

  const problem = getProblem(access, orgSlug);
  if (!problem) {
    return {
      title: t("Seer can't access %s", repoName),
      variant: 'warning',
      body: t(
        "Sentry can't tell what's wrong. Check the repo name, or continue and Seer will try again."
      ),
      actions: [continueRun],
    };
  }

  // Checking again could still help, but the popup has stopped doing it every few seconds.
  if (!isWatching && !isSettled(access.status)) {
    return {
      title: t("Seer can't access %s", repoName),
      variant: 'warning',
      body: problem.body,
      note: t('Stopped checking every few seconds.'),
      actions: [problem.fix, checkAgain],
    };
  }
  return {
    title: t("Seer can't access %s", repoName),
    variant: 'warning',
    body: problem.body,
    actions: [problem.fix],
  };
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
 * is yes. Until this pause's first answer it shows that it's checking, and a failed check keeps
 * whatever it showed last, since it can't say anything new. If it stops checking without an
 * answer, it says it couldn't check. The run resumes on one of its actions or on the user's next
 * message.
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
  // Whether to keep checking: for POLL_FOR_MS after the popup opens.
  const [isWatching, setIsWatching] = useState(true);
  const {start: startWatching} = useTimeout({
    timeMs: POLL_FOR_MS,
    onTimeout: () => setIsWatching(false),
  });
  const repoAccessOptions = apiOptions.as<RepoAccess>()(
    '/organizations/$organizationIdOrSlug/seer/repo-access/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {repoName: data.repo_name},
      staleTime: 0,
    }
  );
  const [url, endpointOptions, marker] = repoAccessOptions.queryKey;
  // A failed check keeps the last answer, so this is this pause's latest answer.
  const {data: access, refetch} = useQuery({
    ...repoAccessOptions,
    // Each pause gets its own answers. Seer just failed to open the repo, so an earlier pause's
    // answer, or one from a check it started, says nothing about this one. Moving the chat in or
    // out of its popped-out window remounts the popup but keeps this pause's answers.
    queryKey: [url, endpointOptions, marker, {pauseId: pendingInput.id}] as const,
    // The fix happens in another tab, so coming back to this one is when to check again.
    refetchOnWindowFocus: true,
    // That other tab hides this one, and a popped-out chat stays on screen while it does, so keep
    // checking while it's hidden.
    refetchIntervalInBackground: true,
    // The next poll checks again anyway.
    retry: false,
    refetchInterval: query => {
      const status = query.state.data?.json.status;
      if (!isWatching || (status && isSettled(status))) {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    startWatching();
  }, [startWatching]);

  const prompt = getPrompt({
    access,
    isWatching,
    repoName: data.repo_name,
    orgSlug: organization.slug,
    onCheckAgain: () => {
      setIsWatching(true);
      startWatching();
      refetch();
    },
    onContinue: () => respondToUserInput(pendingInput.id, {decision: 'retry'}),
  });
  const isChecking = prompt.body === null;

  return (
    <Container padding="0 xl">
      <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}>
        <Alert variant={prompt.variant}>
          <Stack gap="lg">
            <Stack gap="xs">
              <Text bold>{prompt.title}</Text>
              {isChecking ? (
                <Placeholder height="1em" width="80%" testId="repo-access-checking" />
              ) : (
                <Text size="sm">{prompt.body}</Text>
              )}
              {prompt.note && (
                <Text size="sm" variant="muted">
                  {prompt.note}
                </Text>
              )}
            </Stack>
            {isChecking ? (
              <Placeholder height="28px" width="160px" />
            ) : isCorrecting ? (
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
              <Stack gap="sm" align="start">
                {prompt.actions.map((action, index) => {
                  const variant = index === 0 ? 'primary' : undefined;
                  return 'to' in action ? (
                    <LinkButton
                      key={action.label}
                      to={action.to}
                      openInNewTab
                      size="sm"
                      variant={variant}
                    >
                      {action.label}
                    </LinkButton>
                  ) : (
                    <Button
                      key={action.label}
                      size="sm"
                      variant={variant}
                      onClick={action.onClick}
                    >
                      {action.label}
                    </Button>
                  );
                })}
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
