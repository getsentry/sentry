import {useQuery} from '@tanstack/react-query';
import {motion} from 'framer-motion';
import {parseAsString, useQueryState} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useSeerSupportedProviderIds} from 'sentry/components/events/autofix/utils';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
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

function nameSegments(name: string) {
  return name
    .split('/')
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean);
}

/** How the repo lookup in Sentry's Seer tools decides a repo name is under an integration. */
function isUnderAccount(repoName: string, integration: Integration) {
  const repo = nameSegments(repoName);
  const [, ...urlPath] = (integration.domainName ?? '')
    .replace(/^https:\/\//, '')
    .split('/');
  return [integration.name, urlPath.join('/')].some(accountName => {
    const account = nameSegments(accountName);
    return (
      account.length > 0 &&
      account.length < repo.length &&
      account.every((segment, index) => segment === repo[index])
    );
  });
}

/**
 * What's stopping Seer from opening the repo right now, and the link that helps fix it. Null when
 * the failure looks fixed.
 */
function getProblem(
  data: ConnectScmData,
  integrations: Integration[],
  integrationsPath: string
): {body: string; link: React.ReactNode} | null {
  if (integrations.length === 0) {
    return {
      body: t('No source control is connected to this organization.'),
      link: (
        <LinkButton to={integrationsPath} openInNewTab size="sm" variant="primary">
          {t('Connect source control')}
        </LinkButton>
      ),
    };
  }
  const account = integrations.find(integration =>
    isUnderAccount(data.repo_name, integration)
  );
  if (!account) {
    return {
      body: t(
        "This repo's account isn't connected to this organization. Connected: %s.",
        integrations.map(integration => integration.name).join(', ')
      ),
      link: (
        <LinkButton to={integrationsPath} openInNewTab size="sm" variant="primary">
          {t('Go to integrations')}
        </LinkButton>
      ),
    };
  }
  if (data.failure_reason === 'repo_not_in_sentry') {
    const [host] = (account.domainName ?? '').replace(/^https:\/\//, '').split('/');
    return {
      body: t(
        "This repo isn't in Sentry. Check its name, and that Sentry can access it on %s.",
        account.provider.name
      ),
      link: host ? (
        <LinkButton href={`https://${host}`} external size="sm" variant="primary">
          {t('Go to %s', account.provider.name)}
        </LinkButton>
      ) : null,
    };
  }
  return null;
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
 * The prompt above the composer while a run waits on a repo it couldn't open. It holds no state:
 * what it shows comes from the run's error, the organization's integrations and the URL. The run
 * resumes on one of its actions or on the user's next message.
 */
export function ConnectScmBlock({
  pendingInput,
  respondToUserInput,
}: ConnectScmBlockProps) {
  const data = pendingInput.data as ConnectScmData;
  const organization = useOrganization();
  const supportedProviderIds = useSeerSupportedProviderIds();
  const [correctingInputId, setCorrectingInputId] = useQueryState(
    CORRECT_REPO_QUERY_PARAM,
    parseAsString
  );
  // Integrations open in a new tab, so coming back to this one is when to check again.
  const {data: allIntegrations} = useQuery({
    ...apiOptions.as<Integration[]>()(
      '/organizations/$organizationIdOrSlug/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {integrationType: 'source_code_management'},
        staleTime: 0,
      }
    ),
    refetchOnWindowFocus: true,
  });

  if (!allIntegrations) {
    return null;
  }

  const problem = getProblem(
    data,
    allIntegrations.filter(
      integration =>
        integration.status === 'active' &&
        integration.organizationIntegrationStatus === 'active' &&
        supportedProviderIds.includes(integration.provider.key)
    ),
    `/settings/${organization.slug}/integrations/?category=source%20code%20management`
  );

  return (
    <Container padding="0 xl">
      <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}}>
        <Alert variant={problem ? 'warning' : 'success'}>
          <Stack gap="lg">
            <Stack gap="xs">
              <Text bold>
                {problem
                  ? t("Seer can't access %s", data.repo_name)
                  : t('Perfect, source control is connected')}
              </Text>
              <Text size="sm">
                {problem ? problem.body : t('Continue and Seer will try again.')}
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
              // The first button is the way forward: the link that fixes it, or Continue once fixed.
              <Stack gap="sm" align="start">
                {problem ? (
                  problem.link
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
