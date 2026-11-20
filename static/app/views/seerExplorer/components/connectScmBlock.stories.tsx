import {Fragment, useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import type {PendingUserInput} from 'sentry/views/seerExplorer/types';

import {ConnectScmBlock} from './connectScmBlock';

interface RepoAccess {
  connectedAccounts: string[];
  status: string;
}

/** Answers the popup's repo access check with `access`, or never when it's null. */
class RepoAccessQueryClient extends QueryClient {
  access: RepoAccess | null;

  constructor(access: RepoAccess | null) {
    super({defaultOptions: {queries: {retry: false}}});
    this.access = access;
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    const access = this.access;
    const queryFn = () =>
      access ? Promise.resolve({json: access, headers: {}}) : new Promise(() => {});
    return {...defaulted, queryFn: queryFn as never};
  };
}

// A story can't wait out the popup's 10 minutes of checking, so TimedOut makes timers of a
// minute or more fire right away while its children's effects run, which is when the popup
// starts that timer. React runs sibling effects in order, so ShortenLongTimers' effect runs
// before them and RestoreTimers' effect after.
const realSetTimeout = window.setTimeout.bind(window);

function ShortenLongTimers() {
  useEffect(() => {
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      realSetTimeout(
        handler,
        timeout !== undefined && timeout >= 60_000 ? 0 : timeout,
        ...args
      )) as typeof window.setTimeout;
  }, []);
  return null;
}

function RestoreTimers() {
  useEffect(() => {
    window.setTimeout = realSetTimeout;
  }, []);
  return null;
}

function TimedOut({children}: {children: ReactNode}) {
  return (
    <Fragment>
      <ShortenLongTimers />
      {children}
      <RestoreTimers />
    </Fragment>
  );
}

function Example({
  failureReason,
  status,
  connectedAccounts = [],
}: {
  failureReason: string;
  /** Null to keep the check from ever answering. */
  status: string | null;
  connectedAccounts?: string[];
}) {
  const [queryClient] = useState(
    () => new RepoAccessQueryClient(status ? {status, connectedAccounts} : null)
  );
  const pendingInput: PendingUserInput = {
    id: `story-${failureReason}-${status}`,
    input_type: 'connect_scm',
    data: {repo_name: 'acme-labs/app', failure_reason: failureReason},
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Container width="420px" borderColor="primary" radius="md" padding="lg 0">
        <ConnectScmBlock pendingInput={pendingInput} respondToUserInput={() => {}} />
      </Container>
    </QueryClientProvider>
  );
}

export default Storybook.story('ConnectScmBlock', story => {
  story('Checking', () => <Example failureReason="repo_not_in_sentry" status={null} />);

  // As if it had checked for 10 minutes without getting an answer.
  story("Couldn't check", () => (
    <TimedOut>
      <Example failureReason="repo_not_in_sentry" status={null} />
    </TimedOut>
  ));

  // As if it had checked for 10 minutes and Seer still couldn't access the repo.
  story('Stopped checking', () => (
    <TimedOut>
      <Example failureReason="repo_not_in_sentry" status="repo_not_in_sentry" />
    </TimedOut>
  ));

  story('No source control connected', () => (
    <Example failureReason="no_scm_integration" status="no_scm_integration" />
  ));

  story("The repo's account isn't connected", () => (
    <Example
      failureReason="scm_account_not_connected"
      status="scm_account_not_connected"
      connectedAccounts={['acme-corp', 'my-group/sub']}
    />
  ));

  story("The repo isn't in Sentry", () => (
    <Example failureReason="repo_not_in_sentry" status="repo_not_in_sentry" />
  ));

  story("Sentry can't tell what's wrong", () => (
    <Example failureReason="no_scm_integration" status="unknown" />
  ));

  story('Fixed, waiting for the user to try again', () => (
    <Example failureReason="repo_not_in_sentry" status="found" />
  ));
});
