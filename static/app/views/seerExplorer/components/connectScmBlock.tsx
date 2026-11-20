import {useEffect, useState} from 'react';
import {useMutation, useMutationState, useQuery} from '@tanstack/react-query';
import {motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {canManageIntegrations} from 'sentry/utils/integrationUtil';
import {fetchMutation} from 'sentry/utils/queryClient';
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

// The integrations directory filtered to source control: where the popup sends people who can
// install integrations (Sentry owners, managers and admins), and where a member's request sends
// the owners.
const SCM_CATEGORY = 'source code management';

/**
 * The key of a member's requests to the owners during one pause. The requests live in the query
 * client rather than in the popup, so moving the chat in or out of its popped-out window (which
 * remounts the popup) doesn't forget them.
 */
function getRequestInstallKey(pauseId: string) {
  return ['seer-explorer-request-scm-install', {pauseId}] as const;
}

interface RepoAccess {
  connectedAccounts: string[];
  /**
   * `found` when Seer can open the repo, `unknown` when Sentry can't say why it can't, or the
   * reason it can't. Asked without a repo, `found` when source control is connected, or
   * `no_scm_integration`.
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

interface Problem {
  body: string;
  fix: {label: string; to: string};
  /**
   * The fix is installing source control, which only Sentry owners, managers and admins can do;
   * members request it from the owners.
   */
  needsInstall: boolean;
}

/**
 * What's stopping Seer from opening the repo, and where to go to fix it. Null when nothing
 * Sentry can name is, so Continue is the way forward.
 */
function getProblem(access: RepoAccess, orgSlug: string): Problem | null {
  const integrationsPath = `/settings/${orgSlug}/integrations/?category=${encodeURIComponent(SCM_CATEGORY)}`;

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
        needsInstall: true,
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
        needsInstall: true,
      };
    case 'repo_not_in_sentry':
      return {
        body: t(
          "This repo isn't in Sentry. Check its name, and that Sentry has access to it."
        ),
        fix: {label: t('Go to repositories'), to: `/settings/${orgSlug}/repos/`},
        needsInstall: false,
      };
    default:
      return {
        body: t("Seer couldn't open this repo."),
        fix: {label: t('Go to integrations'), to: integrationsPath},
        needsInstall: false,
      };
  }
}

/**
 * For members, who can't install integrations: emails the organization's owners to install
 * source control, with why Seer needs it.
 */
function RequestInstallButton({
  message,
  pauseId,
  requested,
}: {
  message: string;
  pauseId: string;
  requested: boolean;
}) {
  const organization = useOrganization();
  const request = useMutation({
    mutationKey: getRequestInstallKey(pauseId),
    // Keep the request for as long as the page is open, however long the popup is gone.
    gcTime: Infinity,
    mutationFn: (requestMessage: string) =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/integration-requests/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        // Any source control integration will do, and the message says what for.
        data: {
          providerType: 'category',
          providerSlug: SCM_CATEGORY,
          message: requestMessage,
        },
      }),
    onSuccess: () => {
      toast.success(t('Request sent to your organization owners.'));
    },
    onError: () => {
      toast.error(t('Error sending the request'));
    },
  });

  return (
    <Button
      size="sm"
      variant="primary"
      busy={request.isPending}
      disabled={request.isPending || requested}
      onClick={() => request.mutate(message)}
    >
      {requested ? t('Installation requested') : t('Request installation')}
    </Button>
  );
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

/**
 * A button that opens where to fix the problem in a new tab, one that acts here, or one that
 * asks the organization's owners to install source control.
 */
type PromptAction =
  | {label: string; to: string}
  | {label: string; onClick: () => void}
  | {requestMessage: string; requested: boolean};

/**
 * How the popup names what Seer couldn't reach: a repo, or, when a list of repos came back empty
 * because no source control is connected, the organization's repos.
 */
function getTitles(repoName: string | null) {
  if (!repoName) {
    return {
      checking: t('Checking whether source control is connected'),
      couldntCheck: t("Couldn't check whether source control is connected"),
      found: t('Perfect, source control is connected'),
      cant: t("Seer can't see this organization's repos"),
      // How a member's request to the owners starts.
      requestStart: t("Seer can't see this organization's repos."),
    };
  }
  return {
    checking: t('Checking whether Seer can access %s', repoName),
    couldntCheck: t("Couldn't check whether Seer can access %s", repoName),
    found: t('Perfect, Seer can access %s', repoName),
    cant: t("Seer can't access %s", repoName),
    requestStart: t("Seer can't access %s.", repoName),
  };
}

/** What the popup says. Every version has the same layout. */
interface Prompt {
  /**
   * The buttons before Correct repo name and Continue without code. The first is the way
   * forward: Check again when it couldn't check, where to fix the problem (or, for a member,
   * asking the owners to), or Continue once there's nothing to fix.
   */
  actions: PromptAction[];
  /** Null while it's checking, when placeholders stand in for the text and the buttons. */
  body: string | null;
  title: string;
  variant: 'muted' | 'success' | 'warning';
  /** Under the body: how a member gets the problem fixed. */
  hint?: string;
  note?: string;
  /**
   * A member has asked the owners to connect this repo, so the popup stops offering to correct
   * its name.
   */
  requested?: boolean;
}

/** What to say, given this pause's latest answer (if any) and whether it's still checking. */
function getPrompt({
  access,
  isWatching,
  repoName,
  orgSlug,
  canInstall,
  requestedMessages,
  onCheckAgain,
  onContinue,
}: {
  access: RepoAccess | undefined;
  /** Whether the user can install integrations, which members can't. */
  canInstall: boolean;
  isWatching: boolean;
  onCheckAgain: () => void;
  onContinue: () => void;
  orgSlug: string;
  /** Null when there's no repo: a list of repos came back empty. */
  repoName: string | null;
  /** The messages of the member's requests to the owners during this pause. */
  requestedMessages: string[];
}): Prompt {
  const checkAgain = {label: t('Check again'), onClick: onCheckAgain};
  const continueRun = {label: t('Continue'), onClick: onContinue};
  const titles = getTitles(repoName);

  if (!access) {
    // No answer for this pause yet, so whatever was wrong may already be fixed. That holds while
    // checks fail too: a failure says nothing about the repo.
    if (isWatching) {
      return {title: titles.checking, variant: 'muted', body: null, actions: []};
    }
    return {
      title: titles.couldntCheck,
      variant: 'warning',
      body: t('Check again, or continue and Seer will try again.'),
      actions: [checkAgain, continueRun],
    };
  }

  if (isFound(access.status)) {
    return {
      title: titles.found,
      variant: 'success',
      body: t('Continue and Seer will try again.'),
      actions: [continueRun],
    };
  }

  const problem = getProblem(access, orgSlug);
  if (!problem) {
    return {
      title: titles.cant,
      variant: 'warning',
      body: t(
        "Sentry can't tell what's wrong. Check the repo name, or continue and Seer will try again."
      ),
      actions: [continueRun],
    };
  }

  // Both problems that need installing source control are ones a member can't fix, so they
  // request it either way, and the message says which one it is. A new problem (say, the owners
  // connected a different account) needs a new request, so only a request for this one counts.
  const mustRequest = problem.needsInstall && !canInstall;
  const requestMessage = `${titles.requestStart} ${problem.body}`;
  const requested = mustRequest && requestedMessages.includes(requestMessage);
  const fix: PromptAction = mustRequest ? {requestMessage, requested} : problem.fix;
  const hint = mustRequest
    ? t(
        'Request it from your Sentry organization owners, and you can continue here once they connect it.'
      )
    : undefined;

  // Checking again could still help, but the popup has stopped doing it every few seconds.
  if (!isWatching && !isSettled(access.status)) {
    return {
      title: titles.cant,
      variant: 'warning',
      body: problem.body,
      hint,
      note: t('Stopped checking every few seconds.'),
      requested,
      actions: [fix, checkAgain],
    };
  }
  return {
    title: titles.cant,
    variant: 'warning',
    body: problem.body,
    hint,
    requested,
    actions: [fix],
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
 * The prompt above the composer while a run waits on a repo it couldn't open, or, with no repo,
 * on source control after a list of repos came back empty without it. What it shows comes from
 * Sentry's answer to "can Seer open this repo now?" (or "is source control connected now?"),
 * which it checks until the answer is yes. Until this pause's first answer it shows that it's
 * checking, and a failed check keeps whatever it showed last, since it can't say anything new. If
 * it stops checking without an answer, it says it couldn't check. The run resumes on one of its
 * actions or on the user's next message.
 */
export function ConnectScmBlock({
  pendingInput,
  respondToUserInput,
}: ConnectScmBlockProps) {
  const data = pendingInput.data as ConnectScmData;
  const repoName = data.repo_name;
  const organization = useOrganization();
  // Whether the field to correct the repo name is open. A later request remounts the block, so
  // it starts closed.
  const [isCorrecting, setIsCorrecting] = useState(false);
  // The messages of the member's requests to the owners during this pause.
  const requestedMessages = useMutationState({
    filters: {mutationKey: getRequestInstallKey(pendingInput.id), status: 'success'},
    select: mutation => mutation.state.variables as string,
  });
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
      // Without a repo, Sentry says whether source control is connected.
      query: repoName ? {repoName} : undefined,
      staleTime: 0,
    }
  );
  const repoAccessKey: ApiQueryKey = repoAccessOptions.queryKey;
  // A failed check keeps the last answer, so this is this pause's latest answer.
  const {data: access, refetch} = useQuery({
    ...repoAccessOptions,
    // Each pause gets its own answers. Seer just failed to open the repo, so an earlier pause's
    // answer, or one from a check it started, says nothing about this one. Moving the chat in or
    // out of its popped-out window remounts the popup but keeps this pause's answers.
    queryKey: [...repoAccessKey, {pauseId: pendingInput.id}] as const,
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
    repoName,
    orgSlug: organization.slug,
    canInstall: canManageIntegrations(organization),
    requestedMessages,
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
              {prompt.hint && <Text size="sm">{prompt.hint}</Text>}
              {prompt.note && (
                <Text size="sm" variant="muted">
                  {prompt.note}
                </Text>
              )}
            </Stack>
            {isChecking ? (
              <Placeholder height="28px" width="160px" />
            ) : isCorrecting && repoName ? (
              <CorrectRepoForm
                repoName={repoName}
                onCancel={() => setIsCorrecting(false)}
                onSubmit={correctedName => {
                  setIsCorrecting(false);
                  respondToUserInput(pendingInput.id, {
                    decision: 'correct_repo',
                    repo_name: correctedName,
                  });
                }}
              />
            ) : (
              <Stack gap="sm" align="start">
                {prompt.actions.map((action, index) => {
                  if ('requestMessage' in action) {
                    return (
                      <RequestInstallButton
                        key="request-installation"
                        message={action.requestMessage}
                        pauseId={pendingInput.id}
                        requested={action.requested}
                      />
                    );
                  }
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
                {repoName && !prompt.requested && (
                  <Button size="sm" onClick={() => setIsCorrecting(true)}>
                    {t('Correct repo name')}
                  </Button>
                )}
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
