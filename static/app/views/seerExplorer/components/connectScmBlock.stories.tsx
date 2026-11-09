import {useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import type {Integration} from 'sentry/types/integrations';
import type {PendingUserInput} from 'sentry/views/seerExplorer/types';

import {ConnectScmBlock} from './connectScmBlock';

function integration(
  key: string,
  providerName: string,
  name: string,
  domainName: string
): Integration {
  return {
    accountType: null,
    domainName,
    gracePeriodEnd: null,
    icon: null,
    id: `${key}-${name}`,
    name,
    organizationIntegrationStatus: 'active',
    provider: {
      aspects: {},
      canAdd: true,
      canDisable: false,
      features: [],
      key,
      name: providerName,
      slug: key,
    },
    scopes: null,
    status: 'active',
  };
}

const GITHUB = integration('github', 'GitHub', 'acme-labs', 'github.com/acme-labs');
const GITLAB = integration(
  'gitlab',
  'GitLab',
  'My Group / Sub',
  'gitlab.com/my-group/sub'
);

/** Answers the popup's integrations request with `integrations`. */
class IntegrationsQueryClient extends QueryClient {
  integrations: Integration[];

  constructor(integrations: Integration[]) {
    super({defaultOptions: {queries: {retry: false}}});
    this.integrations = integrations;
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    const queryFn = () => Promise.resolve({json: this.integrations, headers: {}});
    return {...defaulted, queryFn: queryFn as never};
  };
}

function Example({
  failureReason,
  integrations,
  repoName,
}: {
  failureReason: string;
  integrations: Integration[];
  repoName: string;
}) {
  const [queryClient] = useState(() => new IntegrationsQueryClient(integrations));
  // Its own id per story, so "Correct repo name" opens the field in that story only.
  const pendingInput: PendingUserInput = {
    id: `story-${failureReason}-${integrations.length}`,
    input_type: 'connect_scm',
    data: {repo_name: repoName, failure_reason: failureReason},
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
    <Example
      failureReason="no_scm_integration"
      integrations={[]}
      repoName="acme-labs/app"
    />
  ));

  story("The repo's account isn't connected", () => (
    <Example
      failureReason="scm_account_not_connected"
      integrations={[GITHUB, GITLAB]}
      repoName="other-org/app"
    />
  ));

  story("The repo isn't in Sentry", () => (
    <Example
      failureReason="repo_not_in_sentry"
      integrations={[GITHUB]}
      repoName="acme-labs/app"
    />
  ));

  story('Fixed, waiting for the user to try again', () => (
    <Example
      failureReason="no_scm_integration"
      integrations={[GITHUB]}
      repoName="acme-labs/app"
    />
  ));
});
