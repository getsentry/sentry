import {browserHistory} from 'react-router';
import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import CreateSampleEventButton from 'app/views/onboarding/createSampleEventButton';

jest.useFakeTimers();

describe('CreateSampleEventButton', function() {
  const {org, project, routerContext} = initializeOrg();
  const groupID = '123';

  const wrapper = mountWithTheme(
    <CreateSampleEventButton source="test" project={project} />,
    routerContext
  );

  beforeEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('creates a sample event', async function() {
    const createRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/create-sample/`,
      method: 'POST',
      body: {groupID},
    });

    wrapper
      .find('[data-test-id="create-sample-event"]')
      .first()
      .simulate('click');

    // The button should be disabled while creating the event
    expect(
      wrapper
        .find('[data-test-id="create-sample-event"]')
        .first()
        .prop('disabled')
    ).toBe(true);

    // We have to await the API calls. We could norally do this using tick(),
    // however since we have enabled fake timers to handle the spin-wait on the
    // event creation, we cannot use tick.
    await Promise.resolve();
    expect(createRequest).toHaveBeenCalled();

    const latestIssueRequest = MockApiClient.addMockResponse({
      url: `/issues/${groupID}/events/latest/`,
      body: {},
    });

    // There is a timeout before we check for the existence of the latest
    // event. Wait for it then wait for the request to complete
    jest.runAllTimers();
    await Promise.resolve();
    expect(latestIssueRequest).toHaveBeenCalled();

    // Wait for the api request and latestEventAvailable to resolve
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    wrapper.update();
    expect(
      wrapper
        .find('[data-test-id="create-sample-event"]')
        .first()
        .prop('disabled')
    ).toBe(false);

    expect(browserHistory.push).toHaveBeenCalledWith(
      `/organizations/${org.slug}/issues/${groupID}/`
    );
  });

  it('waits for the latest event to be processed', async function() {
    const createRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/create-sample/`,
      method: 'POST',
      body: {groupID},
    });

    wrapper
      .find('[data-test-id="create-sample-event"]')
      .first()
      .simulate('click');

    await Promise.resolve();
    expect(createRequest).toHaveBeenCalled();

    // Start with no latest event
    let latestIssueRequest = MockApiClient.addMockResponse({
      url: `/issues/${groupID}/events/latest/`,
      statusCode: 404,
      body: {},
    });

    // Wait for the timeout once, the first request will 404
    jest.runAllTimers();
    await Promise.resolve();
    expect(latestIssueRequest).toHaveBeenCalled();
    await Promise.resolve();

    // Second request will be successful
    MockApiClient.clearMockResponses();
    latestIssueRequest = MockApiClient.addMockResponse({
      url: `/issues/${groupID}/events/latest/`,
      statusCode: 200,
      body: {},
    });

    jest.runAllTimers();
    await Promise.resolve();
    expect(latestIssueRequest).toHaveBeenCalled();
    await Promise.resolve();

    // wait for latestEventAvailable to resolve
    await Promise.resolve();

    expect(browserHistory.push).toHaveBeenCalledWith(
      `/organizations/${org.slug}/issues/${groupID}/`
    );
  });
});
