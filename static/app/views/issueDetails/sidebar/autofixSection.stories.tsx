import {useState, type ReactNode} from 'react';
import {QueryClient, QueryClientProvider, skipToken} from '@tanstack/react-query';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {IssueCategory, IssueType, type Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AutofixSection} from './autofixSection';

// The section only reads these fields.
const GROUP = {
  id: '1',
  shortId: 'CHECKOUT-42',
  title: 'TypeError: Reduce of empty array with no initial value',
  issueCategory: IssueCategory.ERROR,
  issueType: IssueType.ERROR,
  platform: 'javascript',
} as unknown as Group;

const PROJECT = {id: '1', slug: 'checkout', platform: 'javascript'} as Project;

/**
 * Answers every request the section makes, so it settles on the start card for
 * an issue without a run: Seer is set up, the issue has no run yet, and the
 * credit check returns the given balance.
 */
class SimulatedSidebarQueryClient extends QueryClient {
  hasEnoughCredits: boolean;

  constructor(hasEnoughCredits: boolean) {
    super({defaultOptions: {queries: {retry: false}}});
    this.hasEnoughCredits = hasEnoughCredits;
  }

  respond(url: string): unknown {
    if (url.includes('/seer/credit-check/')) {
      return {hasEnoughCredits: this.hasEnoughCredits};
    }
    if (url.includes('/autofix/setup/')) {
      return {
        integration: {ok: true, reason: null},
        billing: {hasAutofixQuota: true},
        seerReposLinked: true,
      };
    }
    if (url.includes('/seer/onboarding-check/')) {
      return {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isSeerConfigured: true,
      };
    }
    if (url.includes(`/issues/${GROUP.id}/autofix/`)) {
      return {autofix: null};
    }
    return [];
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    if (defaulted.queryFn === skipToken) {
      return defaulted;
    }

    const url = String(defaulted.queryKey[0]);
    const queryFn = () => Promise.resolve({json: this.respond(url), headers: {}});
    // Each answer matches the response type of the query that asked for it.
    return {...defaulted, queryFn: queryFn as never};
  };
}

interface SidebarStoryProps {
  description: ReactNode;
  hasEnoughCredits?: boolean;
  /**
   * Billing members configure auto-reload; everyone else contacts their admins.
   */
  isBillingMember?: boolean;
}

/**
 * The real sidebar section for an org with credit checks on, at the issue
 * sidebar's width.
 */
function SidebarStory({
  description,
  hasEnoughCredits = false,
  isBillingMember = false,
}: SidebarStoryProps) {
  const organization = useOrganization();
  const [queryClient] = useState(() => new SimulatedSidebarQueryClient(hasEnoughCredits));

  return (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        {description}
      </Text>
      <OrganizationContext.Provider
        value={{
          ...organization,
          access: isBillingMember
            ? [...organization.access, 'org:billing']
            : organization.access.filter(scope => scope !== 'org:billing'),
          hideAiFeatures: false,
          features: [
            ...organization.features,
            'seer-credit-checks',
            'token-billed-seer-enabled',
          ],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <Container width="325px" padding="xl" border="primary" radius="md">
            <AutofixSection group={GROUP} project={PROJECT} />
          </Container>
        </QueryClientProvider>
      </OrganizationContext.Provider>
    </Stack>
  );
}

export default Storybook.story('AutofixSection', story => {
  story('Out of credits: before a run', () => (
    <SidebarStory description='No run yet, seen by a member. The muted autofix-start notice takes the place of the "Have Seer..." explainer, right above Start Analysis, which stays on screen but disabled (autofix_root_cause).' />
  ));

  story('Out of credits: before a run, billing member', () => (
    <SidebarStory
      description="The same notice for a billing member, who configures auto-reload instead of contacting an admin."
      isBillingMember
    />
  ));

  story('With credits: before a run', () => (
    <SidebarStory
      description="For comparison: no notice, and Start Analysis is enabled."
      hasEnoughCredits
    />
  ));
});
