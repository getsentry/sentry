import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CreateSampleEventButton} from 'sentry/components/onboarding/createSampleEventButton';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

describe('CreateSampleEventButton', () => {
  const org = OrganizationFixture();
  const project = ProjectFixture();
  const groupID = '123';
  const createSampleText = 'Create a sample event';

  function renderComponent() {
    return render(
      <CreateSampleEventButton
        source="test"
        project={{...project, platform: 'javascript'}}
      >
        {createSampleText}
      </CreateSampleEventButton>,
      {
        organization: org,
      }
    );
  }

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('creates a sample event', async () => {
    const {router} = renderComponent();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/create-sample/`,
      method: 'POST',
      body: {groupID},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/issues/${groupID}/events/latest/`,
      body: {},
    });

    const sampleButton = await screen.findByRole('button', {name: createSampleText});
    await userEvent.click(sampleButton, {delay: null});

    await waitFor(() =>
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${org.slug}/issues/${groupID}/`,
          query: expect.objectContaining({
            project: project.id,
            referrer: 'sample-error',
          }),
        })
      )
    );
  });

  it('fires the legacy view sample event when hasScmOnboarding is not set', async () => {
    renderComponent();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/create-sample/`,
      method: 'POST',
      body: {groupID},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/issues/${groupID}/events/latest/`,
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: createSampleText}), {
      delay: null,
    });

    await waitFor(() =>
      expect(trackAnalytics).toHaveBeenCalledWith(
        'growth.onboarding_view_sample_event',
        expect.objectContaining({platform: 'javascript'})
      )
    );
    expect(trackAnalytics).not.toHaveBeenCalledWith(
      'onboarding.scm_view_sample_event_clicked',
      expect.anything()
    );
  });

  it('fires the SCM view sample event when hasScmOnboarding is true', async () => {
    render(
      <CreateSampleEventButton
        source="test"
        project={{...project, platform: 'javascript'}}
        hasScmOnboarding
      >
        {createSampleText}
      </CreateSampleEventButton>,
      {organization: org}
    );
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/create-sample/`,
      method: 'POST',
      body: {groupID},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/issues/${groupID}/events/latest/`,
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: createSampleText}), {
      delay: null,
    });

    await waitFor(() =>
      expect(trackAnalytics).toHaveBeenCalledWith(
        'onboarding.scm_view_sample_event_clicked',
        expect.objectContaining({platform: 'javascript'})
      )
    );
    expect(trackAnalytics).not.toHaveBeenCalledWith(
      'growth.onboarding_view_sample_event',
      expect.anything()
    );
  });

  it('waits for the latest event to be processed', async () => {
    jest.useFakeTimers();
    const {router} = renderComponent();
    const createRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/create-sample/`,
      method: 'POST',
      body: {groupID},
    });

    // Start with 404 — fetchQuery will retry after retryDelay
    let latestIssueRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/issues/${groupID}/events/latest/`,
      statusCode: 404,
      body: {},
    });

    await userEvent.click(await screen.findByRole('button', {name: createSampleText}), {
      delay: null,
    });

    await waitFor(() => expect(createRequest).toHaveBeenCalled());

    // fetchQuery fires immediately — wait for the first (404) attempt
    await waitFor(() => expect(latestIssueRequest).toHaveBeenCalled());

    // Set up 200 for the retry
    MockApiClient.clearMockResponses();
    latestIssueRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/issues/${groupID}/events/latest/`,
      statusCode: 200,
      body: {},
    });

    // Advance past the retry delay so fetchQuery retries, wrapped in act
    // to capture the navigate state update from onSuccess
    await act(() => jest.advanceTimersByTimeAsync(EVENT_POLL_INTERVAL));
    await waitFor(() => expect(latestIssueRequest).toHaveBeenCalled());

    await waitFor(() =>
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${org.slug}/issues/${groupID}/`,
          query: expect.objectContaining({
            project: project.id,
            referrer: 'sample-error',
          }),
        })
      )
    );

    expect(trackAnalytics).toHaveBeenCalledWith(
      'sample_event.created',
      expect.objectContaining({
        organization: expect.objectContaining(org),
        project_id: project.id,
        interval: 1000,
        retries: 1,
        source: 'test',
        platform: 'javascript',
      })
    );

    expect(Sentry.captureMessage).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});

const EVENT_POLL_INTERVAL = 1000;
