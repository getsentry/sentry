import {useCallback, useEffect, useState} from 'react';
import {
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Stack} from '@sentry/scraps/layout';
import {usePictureInPicture} from '@sentry/scraps/pictureInPicture';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
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

import {openConnectScmModal} from './connectScmModal';
import {
  REPO_ACCESS_POLL_INTERVAL_MS,
  REPO_ACCESS_WAIT_MS,
  repoAccessInstallScope,
  repoAccessQueryOptions,
  type RepoAccess,
} from './repoAccessQuery';

// Source control's category in the integrations directory. A member's request sends the owners
// there, and so does the popup when Seer couldn't open the repo for a reason it can't name.
const SCM_CATEGORY = 'source code management';

/**
 * The key of a member's requests to the owners during one pause. The requests live in the query
 * client rather than in the popup, so moving the chat in or out of its popped-out window (which
 * remounts the popup) doesn't forget them.
 */
function getRequestInstallKey(pauseId: string) {
  return ['seer-explorer-request-scm-install', {pauseId}] as const;
}

function autoResumeOptions(orgSlug: string, pauseId: string) {
  return queryOptions({
    queryKey: ['seer-explorer-scm-auto-resume', orgSlug, pauseId],
    queryFn: (): 'attempted' | 'failed' | null => null,
    initialData: null,
    enabled: false,
    gcTime: Infinity,
  });
}

/** Polling won't fix an ambiguous name or a failure Sentry can't explain. */
function isSettled(status: RepoAccess['status']) {
  return status === 'found' || status === 'unknown' || status === 'repo_ambiguous';
}

type Problem = {body: string} & (
  | {
      /**
       * The fix is installing source control, which only Sentry owners, managers and admins can
       * do; members request it from the owners.
       */
      needsInstall: true;
    }
  | {fix: {label: string; to: string}; needsInstall: false}
);

/**
 * What's stopping Seer from opening the repo, and how to fix it. Null when nothing Sentry can
 * name is, so Continue is the way forward.
 */
function getProblem(access: RepoAccess, orgSlug: string): Problem | null {
  const integrationsPath = `/settings/${orgSlug}/integrations/?category=${encodeURIComponent(SCM_CATEGORY)}`;

  if (access.syncFailure) {
    return {
      body: t("Sentry couldn't finish importing repositories."),
      fix: {label: t('Go to repositories'), to: `/settings/${orgSlug}/repos/`},
      needsInstall: false,
    };
  }
  switch (access.status) {
    case 'unknown':
      return null;
    case 'no_scm_integration':
      return {
        body: t('No source control is connected to this organization.'),
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
  repoName,
  requested,
}: {
  message: string;
  pauseId: string;
  repoName: string;
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
          repoName,
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

/** What the popup says. Every version has the same layout. */
interface Prompt {
  /**
   * The buttons before Correct repo name and Continue without code. The first is the way
   * forward: Check again when it couldn't check, where to fix the problem (or, for a member,
   * asking the owners to), or Continue when Sentry can't say what's wrong.
   */
  actions: PromptAction[];
  /** Null while it's checking, when placeholders stand in for the text and the buttons. */
  body: string | null;
  title: string;
  variant: 'muted' | 'warning';
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
  onConnect,
  onContinue,
}: {
  access: RepoAccess | undefined;
  /** Whether the user can install integrations, which members can't. */
  canInstall: boolean;
  isWatching: boolean;
  onCheckAgain: () => void;
  onConnect: () => void;
  onContinue: () => void;
  orgSlug: string;
  repoName: string;
  /** The messages of the member's requests to the owners during this pause. */
  requestedMessages: string[];
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

  if (access.status === 'repos_syncing') {
    return {
      title: t('Checking whether Seer can access %s', repoName),
      variant: 'muted',
      body: t('Sentry is importing repositories.'),
      note: isWatching ? undefined : t('Stopped checking every few seconds.'),
      actions: isWatching ? [] : [checkAgain],
    };
  }
  if (access.status === 'repo_ambiguous') {
    return {
      title: t("Seer can't access %s", repoName),
      variant: 'warning',
      body: t('More than one repository matches this name.'),
      actions: [],
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

  // Both problems that need installing source control are ones a member can't fix, so they
  // request it either way, and the message says which one it is. A new problem (say, the owners
  // connected a different account) needs a new request, so only a request for this one counts.
  const mustRequest = problem.needsInstall && !canInstall;
  const requestMessage = `${t("Seer can't access %s.", repoName)} ${problem.body}`;
  const requested = mustRequest && requestedMessages.includes(requestMessage);
  const fix: PromptAction = problem.needsInstall
    ? canInstall
      ? {label: t('Connect source control'), onClick: onConnect}
      : {requestMessage, requested}
    : problem.fix;
  const hint = mustRequest
    ? t(
        'Request it from your Sentry organization owners, and you can continue here once they connect it.'
      )
    : undefined;

  // Checking again could still help, but the popup has stopped doing it every few seconds.
  if (!isWatching && !isSettled(access.status)) {
    return {
      title: t("Seer can't access %s", repoName),
      variant: 'warning',
      body: problem.body,
      hint,
      note: t('Stopped checking every few seconds.'),
      requested,
      actions: [fix, checkAgain],
    };
  }
  return {
    title: t("Seer can't access %s", repoName),
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
 * The prompt above the composer while a run waits on a repo it couldn't open. What it shows
 * comes from Sentry's answer to "can Seer open this repo now?", which it checks until the answer
 * is yes. Until this pause's first answer it shows that it's checking, and a failed check keeps
 * whatever it showed last, since it can't say anything new. If it stops checking without an
 * answer, it says it couldn't check. The run resumes on one of its actions, on the user's next
 * message, or by itself once Seer can open the repo. It resumes by itself once per pause.
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
  // The messages of the member's requests to the owners during this pause.
  const requestedMessages = useMutationState({
    filters: {mutationKey: getRequestInstallKey(pendingInput.id), status: 'success'},
    select: mutation => mutation.state.variables as string,
  });
  const [isWatching, setIsWatching] = useState(true);
  const {start: startWatching} = useTimeout({
    timeMs: REPO_ACCESS_WAIT_MS,
    onTimeout: () => setIsWatching(false),
  });
  const {data: integrationId} = useQuery(
    repoAccessInstallScope(organization.slug, pendingInput.id)
  );
  // The popup owns polling in chat. The modal observes this same query without starting a poll.
  const {data: access, refetch} = useQuery({
    ...repoAccessQueryOptions({
      orgSlug: organization.slug,
      repoName: data.repo_name,
      integrationId: integrationId ?? undefined,
      checkId: pendingInput.id,
    }),
    // The fix happens in another tab, so coming back to this one is when to check again.
    refetchOnWindowFocus: query => query.state.data?.json.status !== 'found',
    // That other tab hides this one, and a popped-out chat stays on screen while it does, so keep
    // checking while it's hidden.
    refetchIntervalInBackground: true,
    refetchInterval: query => {
      const status = query.state.data?.json.status;
      if (!isWatching || (status && isSettled(status))) {
        return false;
      }
      return REPO_ACCESS_POLL_INTERVAL_MS;
    },
  });

  useEffect(() => {
    startWatching();
  }, [startWatching]);

  const canAccess = access?.status === 'found';
  const queryClient = useQueryClient();
  const {data: resumeStatus} = useQuery(
    autoResumeOptions(organization.slug, pendingInput.id)
  );
  const resumeChat = useCallback(() => {
    const {queryKey} = autoResumeOptions(organization.slug, pendingInput.id);
    queryClient.setQueryData(queryKey, 'attempted');
    respondToUserInput(
      pendingInput.id,
      {decision: 'retry'},
      {onError: () => queryClient.setQueryData(queryKey, 'failed')}
    );
  }, [organization.slug, pendingInput.id, queryClient, respondToUserInput]);

  useEffect(() => {
    const {queryKey} = autoResumeOptions(organization.slug, pendingInput.id);
    if (canAccess && !queryClient.getQueryData(queryKey)) {
      resumeChat();
    }
  }, [canAccess, organization.slug, pendingInput.id, queryClient, resumeChat]);

  function checkAgain() {
    refetch({cancelRefetch: false});
  }

  function watchInstall() {
    setIsWatching(true);
    startWatching();
  }

  const {pipWindow, closePipWindow} = usePictureInPicture();

  function openConnectModal() {
    openConnectScmModal({
      inputId: pendingInput.id,
      repoName: data.repo_name,
      onInstall: watchInstall,
    });
  }

  if (canAccess) {
    // The chat shows errors from the resume request. Only keep a way to retry it.
    return resumeStatus === 'failed' ? (
      <Container padding="0 xl">
        <Button size="sm" onClick={resumeChat}>
          {t('Continue')}
        </Button>
      </Container>
    ) : null;
  }

  const prompt: Prompt = pipWindow
    ? {
        title: t("Seer can't access %s", data.repo_name),
        variant: 'warning',
        body: t('To fix this, move the chat back into the main window.'),
        actions: [{label: t('Move chat back'), onClick: closePipWindow}],
      }
    : getPrompt({
        access,
        isWatching,
        repoName: data.repo_name,
        orgSlug: organization.slug,
        canInstall: canManageIntegrations(organization),
        requestedMessages,
        onCheckAgain: checkAgain,
        onConnect: openConnectModal,
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
                  if ('requestMessage' in action) {
                    return (
                      <RequestInstallButton
                        key="request-installation"
                        message={action.requestMessage}
                        pauseId={pendingInput.id}
                        repoName={data.repo_name}
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
                {!prompt.requested && (
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
