import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

import {AiConfigureSeerQuotaSidebar} from './aiConfigureSeerQuotaSidebar';

function makeAiConfig(
  overrides: Partial<ReturnType<typeof useAiConfig>> = {}
): ReturnType<typeof useAiConfig> {
  return {
    areAiFeaturesAllowed: true,
    autofixEnabled: true,
    hasAutofix: true,
    hasAutofixQuota: true,
    hasGithubIntegration: true,
    hasResources: true,
    hasSummary: true,
    isAutofixSetupLoading: false,
    orgNeedsGenAiAcknowledgement: false,
    refetchAutofixSetup: jest.fn(),
    seerReposLinked: true,
    ...overrides,
  };
}

describe('AiConfigureSeerQuotaSidebar', () => {
  const group = GroupFixture();
  const project = ProjectFixture();
  const event = EventFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders loading placeholder when autofix setup is loading', () => {
    const organization = OrganizationFixture({features: ['seer-billing']});
    const subscription = SubscriptionFixture({organization});
    act(() => SubscriptionStore.set(organization.slug, subscription));

    render(
      <AiConfigureSeerQuotaSidebar
        aiConfig={makeAiConfig({isAutofixSetupLoading: true})}
        group={group}
        project={project}
        event={event}
      />,
      {organization}
    );

    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    expect(screen.queryByText('Meet Seer, your AI assistant')).not.toBeInTheDocument();
  });

  it('renders AutofixContent when user has autofix quota', () => {
    const organization = OrganizationFixture({features: ['seer-billing']});
    const subscription = SubscriptionFixture({organization});
    act(() => SubscriptionStore.set(organization.slug, subscription));

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
        needsConfigReminder: false,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: {autofix: null},
    });

    render(
      <AiConfigureSeerQuotaSidebar
        aiConfig={makeAiConfig({hasAutofixQuota: true})}
        group={group}
        project={project}
        event={event}
      />,
      {organization}
    );

    expect(screen.queryByText('Meet Seer, your AI assistant')).not.toBeInTheDocument();
  });

  it('renders AutofixContent when seer-billing feature is not present', () => {
    const organization = OrganizationFixture({features: []});
    const subscription = SubscriptionFixture({organization});
    act(() => SubscriptionStore.set(organization.slug, subscription));

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
        needsConfigReminder: false,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
      body: {autofix: null},
    });

    render(
      <AiConfigureSeerQuotaSidebar
        aiConfig={makeAiConfig({hasAutofixQuota: false})}
        group={group}
        project={project}
        event={event}
      />,
      {organization}
    );

    expect(screen.queryByText('Meet Seer, your AI assistant')).not.toBeInTheDocument();
  });

  it('renders upsell card with enabled button when user has billing permissions', () => {
    const organization = OrganizationFixture({
      features: ['seer-billing'],
      access: ['org:billing'] as any,
    });
    const subscription = SubscriptionFixture({organization, canSelfServe: true});
    act(() => SubscriptionStore.set(organization.slug, subscription));

    render(
      <AiConfigureSeerQuotaSidebar
        aiConfig={makeAiConfig({hasAutofixQuota: false})}
        group={group}
        project={project}
        event={event}
      />,
      {organization}
    );

    expect(screen.getByText('Meet Seer, your AI assistant')).toBeInTheDocument();
    const button = screen.getByRole('button', {name: 'Try out Seer now'});
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/billing/overview/?product=seer`
    );
  });

  it('renders upsell card with disabled button when user lacks billing permissions', () => {
    const organization = OrganizationFixture({
      features: ['seer-billing'],
      access: [] as any,
    });
    const subscription = SubscriptionFixture({organization, canSelfServe: false});
    act(() => SubscriptionStore.set(organization.slug, subscription));

    render(
      <AiConfigureSeerQuotaSidebar
        aiConfig={makeAiConfig({hasAutofixQuota: false})}
        group={group}
        project={project}
        event={event}
      />,
      {organization}
    );

    expect(screen.getByText('Meet Seer, your AI assistant')).toBeInTheDocument();
    const button = screen.getByRole('button', {name: 'Try out Seer now'});
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});
