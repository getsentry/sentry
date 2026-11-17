import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {motion} from 'framer-motion';
import {parseAsString, useQueryState} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  ConnectScmData,
  PendingUserInput,
  RespondToUserInputOptions,
} from 'sentry/views/seerExplorer/types';

// Holds the id of the request whose name field is open, so a refresh keeps it open and a later
// request starts closed.
const CORRECT_REPO_QUERY_PARAM = 'seerCorrectRepo';

// The fix usually lands a few seconds after the user makes it (a webhook, then a sync job), and
// the slowest normal path (a sync retrying) takes about 6 minutes. After that, only coming back
// to the tab checks again.
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

/** Whether checking again can't help: Seer can open the repo, or Sentry can't say why not. */
function isSettled(status: string) {
  return status === 'found' || status === 'unknown';
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

  switch (access.status) {
    case 'found':
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
 * is yes, and the URL. Until this pause's first answer, or if checking fails, it shows the run's
 * error. The run resumes on one of its actions or on the user's next message.
 */
export function ConnectScmBlock({
  pendingInput,
  respondToUserInput,
}: ConnectScmBlockProps) {
  const data = pendingInput.data as ConnectScmData;
  const organization = useOrganization();
  const [correctingInputId, setCorrectingInputId] = useQueryState(
    CORRECT_REPO_QUERY_PARAM,
    parseAsString
  );
  const [shownAt] = useState(() => Date.now());
  // The cache can hold an answer from an earlier pause for this repo, which this pause's failure
  // may contradict, so only answers from after this one opened count.
  const isCurrent = (dataUpdatedAt: number) => dataUpdatedAt >= shownAt;
  const {data: latestAccess, dataUpdatedAt} = useQuery({
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
    refetchInterval: query => {
      const status = isCurrent(query.state.dataUpdatedAt)
        ? query.state.data?.json.status
        : undefined;
      if ((status && isSettled(status)) || Date.now() - shownAt > POLL_FOR_MS) {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
  });

  const checkedAccess = isCurrent(dataUpdatedAt) ? latestAccess : undefined;
  const access: RepoAccess = checkedAccess ?? {
    status: data.failure_reason,
    connectedAccounts: [],
  };
  const problem = getProblem(access, organization.slug);
  const found = access.status === 'found';

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
            </Stack>
            {correctingInputId === pendingInput.id ? (
              <CorrectRepoForm
                repoName={data.repo_name}
                onCancel={() => setCorrectingInputId(null)}
                onSubmit={repoName => {
                  setCorrectingInputId(null);
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
                <Button size="sm" onClick={() => setCorrectingInputId(pendingInput.id)}>
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
