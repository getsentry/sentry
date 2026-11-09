import {useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import type {PendingUserInput} from 'sentry/views/seerExplorer/types';

import {ConnectScmBlock} from './connectScmBlock';

interface RepoAccess {
  connectedAccounts: string[];
  status: string;
}

/** Answers the popup's repo access check with `access`. */
class RepoAccessQueryClient extends QueryClient {
  access: RepoAccess;

  constructor(access: RepoAccess) {
    super({defaultOptions: {queries: {retry: false}}});
    this.access = access;
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    const queryFn = () => Promise.resolve({json: this.access, headers: {}});
    return {...defaulted, queryFn: queryFn as never};
  };
}

function Example({
  failureReason,
  status,
  connectedAccounts = [],
}: {
  failureReason: string;
  status: string;
  connectedAccounts?: string[];
}) {
  const [queryClient] = useState(
    () => new RepoAccessQueryClient({status, connectedAccounts})
  );
  // Its own id per story, so "Correct repo name" opens the field in that story only.
  const pendingInput: PendingUserInput = {
    id: `story-${failureReason}-${status}`,
    input_type: 'connect_scm',
    data: {repo_name: 'acme-labs/app', failure_reason: failureReason},
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Container width="420px" border="primary" radius="md" padding="lg 0">
        <ConnectScmBlock pendingInput={pendingInput} respondToUserInput={() => {}} />
      </Container>
    </QueryClientProvider>
  );
}

export default Storybook.story('ConnectScmBlock', story => {
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
