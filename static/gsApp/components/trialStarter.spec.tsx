import type {ComponentProps} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import TrialStarter from 'getsentry/components/trialStarter';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

type RendererProps = Parameters<ComponentProps<typeof TrialStarter>['children']>[0];

describe('TrialStarter', function () {
  const org = OrganizationFixture();
  const sub = SubscriptionFixture({organization: org});
  SubscriptionStore.set(org.slug, sub);

  it('starts a trial', async function () {
    const handleTrialStarted = jest.fn();
    const renderer = jest.fn(({}: RendererProps) => <div>render text</div>);
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/`,
      body: org,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/projects/`,
      body: [ProjectFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      body: [TeamFixture()],
    });

    render(
      <TrialStarter
        organization={org}
        source="test-abc"
        onTrialStarted={handleTrialStarted}
      >
        {renderer}
      </TrialStarter>
    );

    expect(screen.getByText('render text')).toBeInTheDocument();
    expect(renderer).toHaveBeenCalled();

    // Setup to start subscription
    const startTrialMock = MockApiClient.addMockResponse({
      url: `/customers/${org.slug}/`,
      method: 'PUT',
    });

    const reloadSubsMock = MockApiClient.addMockResponse({
      url: `/subscriptions/${org.slug}/`,
      method: 'GET',
      body: sub,
    });

    // Start trial
    await act(() => renderer.mock.calls.at(-1)![0].startTrial());
    expect(startTrialMock).toHaveBeenCalled();

    // Trial started completed
    expect(handleTrialStarted).toHaveBeenCalled();
    expect(reloadSubsMock).toHaveBeenCalled();
    const startedCall = renderer.mock.calls.at(-1)![0];

    expect(startedCall.trialStarting).toBe(false);
    expect(startedCall.trialStarted).toBe(true);
    expect(startedCall.trialFailed).toBe(false);
  });

  it('handles failing to start a trial', async function () {
    const handleTrialFailed = jest.fn();
    const renderer = jest.fn(({}: RendererProps) => null);

    render(
      <TrialStarter
        organization={org}
        source="test-abc"
        onTrialFailed={handleTrialFailed}
      >
        {renderer}
      </TrialStarter>
    );

    // Setup to start subscription
    const startTrialMock = MockApiClient.addMockResponse({
      url: `/customers/${org.slug}/`,
      method: 'PUT',
      statusCode: 400,
    });

    // Start trial
    await act(() => renderer.mock.calls.at(-1)![0].startTrial());
    expect(startTrialMock).toHaveBeenCalled();

    // Trial started completed (skip second render call)
    const startedCall = renderer.mock.calls.at(-1)![0];
    expect(handleTrialFailed).toHaveBeenCalled();

    expect(startedCall.trialStarting).toBe(false);
    expect(startedCall.trialStarted).toBe(false);
    expect(startedCall.trialFailed).toBe(true);
  });
});
