import {useEffect, useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Container, Stack} from '@sentry/scraps/layout';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';
import {PRLinksBar} from 'sentry/views/seerExplorer/components/prLinksBar';
import {SeerExplorerContent} from 'sentry/views/seerExplorer/components/seerExplorerContent';
import {
  SeerExplorerChatStateProvider,
  useSeerExplorerChatDispatch,
} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import type {
  Block,
  RepoPRState,
  SeerExplorerResponse,
} from 'sentry/views/seerExplorer/types';

function prState(overrides: Partial<RepoPRState> & {repo_name: string}): RepoPRState {
  return {
    branch_name: 'seer/add-service-tests',
    commit_sha: 'a1b2c3d',
    pr_creation_error: null,
    pr_creation_status: 'completed',
    pr_id: 3101,
    pr_number: 113,
    pr_url: `https://github.com/${overrides.repo_name}/pull/113`,
    title: 'feat: Add comprehensive tests for user and task services',
    ...overrides,
  };
}

const COMPLETED = prState({repo_name: 'acme/backend'});

const CREATING = prState({
  repo_name: 'acme/frontend',
  pr_creation_status: 'creating',
  pr_number: null,
  pr_url: null,
  title: null,
});

const UPDATING = prState({repo_name: 'acme/api', pr_creation_status: 'creating'});

const ERRORED = prState({
  repo_name: 'acme/infra',
  pr_creation_error:
    'The GitHub integration does not have write access to this repository.',
  pr_creation_status: 'error',
  pr_number: null,
  pr_url: null,
  title: 'chore: Raise worker memory limit',
});

const PUSH_FAILED = prState({
  repo_name: 'acme/web',
  pr_creation_error: 'Pushing to seer/add-service-tests was rejected by a branch rule.',
  pr_creation_status: 'error',
});

const ALL_STATES = [COMPLETED, CREATING, UPDATING, ERRORED, PUSH_FAILED];

function byRepo(...states: RepoPRState[]): Record<string, RepoPRState> {
  return Object.fromEntries(states.map(state => [state.repo_name, state]));
}

function Frame({children}: {children: React.ReactNode}) {
  return (
    <Container width="520px" border="primary" radius="md" padding="lg 0">
      {children}
    </Container>
  );
}

export default Storybook.story('PRLinksBar', story => {
  story('Opened', () => (
    <Frame>
      <PRLinksBar repoPRStates={byRepo(COMPLETED)} />
    </Frame>
  ));

  story('Opening', () => (
    <Frame>
      <PRLinksBar repoPRStates={byRepo(CREATING)} />
    </Frame>
  ));

  story('Pushing to an open PR', () => (
    <Frame>
      <PRLinksBar repoPRStates={byRepo(UPDATING)} />
    </Frame>
  ));

  story('Failed', () => (
    <Frame>
      <PRLinksBar repoPRStates={byRepo(ERRORED)} />
    </Frame>
  ));

  story('Failed to push to an open PR', () => (
    <Frame>
      <PRLinksBar repoPRStates={byRepo(PUSH_FAILED)} />
    </Frame>
  ));

  story('Several repos', () => (
    <Frame>
      <PRLinksBar repoPRStates={byRepo(...ALL_STATES)} />
    </Frame>
  ));

  story('In the Seer panel', () => (
    <Stack gap="md">
      <Text variant="muted">Drag the bottom-right corner to resize the panel.</Text>
      <Storybook.SizingWindow style={{width: 480, height: 700, padding: 0}}>
        <SimulatedPanel />
      </Storybook.SizingWindow>
    </Stack>
  ));
});

const TIMESTAMP = '2026-10-07T12:00:00Z';
const RUN_ID = 1;

// A PR still opening keeps the run in progress, so a stale updated_at would read as timed out.
const simulatedRun = (): SeerExplorerResponse => ({
  session: {
    status: 'completed',
    updated_at: new Date().toISOString(),
    repo_pr_states: byRepo(...ALL_STATES),
    blocks: Array.from({length: 6}, (_, turn): Block[] => [
      {
        id: `question-${turn}`,
        message: {role: 'user', content: 'Why are checkout requests timing out?'},
        timestamp: TIMESTAMP,
        loading: false,
      },
      {
        id: `answer-${turn}`,
        message: {
          role: 'assistant',
          content:
            'The cart service waits on the tax API without a timeout, so slow tax responses hold every checkout request open until the gateway gives up after 30 seconds. I added a 5 second timeout with a cached fallback rate and am opening pull requests in the affected repos.',
        },
        timestamp: TIMESTAMP,
        loading: false,
      },
    ]).flat(),
  },
});

/** Answers the panel's run request with the simulated run, and every other request with an empty list. */
class SimulatedRunQueryClient extends QueryClient {
  constructor() {
    super({defaultOptions: {queries: {retry: false}}});
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    const url = String(defaulted.queryKey[0]);
    const queryFn = () =>
      Promise.resolve({
        json: url.includes('/seer/explorer-chat/') ? simulatedRun() : [],
        headers: {},
      });
    return {...defaulted, queryFn: queryFn as never};
  };
}

function SelectSimulatedRun() {
  const dispatch = useSeerExplorerChatDispatch();
  useEffect(() => dispatch({type: 'set run id', payload: RUN_ID}), [dispatch]);
  return null;
}

function SimulatedPanel() {
  const organization = useOrganization();
  const [queryClient] = useState(() => new SimulatedRunQueryClient());

  return (
    <OrganizationContext.Provider
      value={{
        ...organization,
        features: [...organization.features, 'ask-seer-create-pr'],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <SeerExplorerChatStateProvider>
          <SelectSimulatedRun />
          <PictureInPictureProvider>
            <SeerExplorerSessionsProvider>
              <SeerExplorerContent getPageReferrer={() => '/'} onClose={() => {}} />
            </SeerExplorerSessionsProvider>
          </PictureInPictureProvider>
        </SeerExplorerChatStateProvider>
      </QueryClientProvider>
    </OrganizationContext.Provider>
  );
}
