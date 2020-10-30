import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import changeReactMentionsInput from 'sentry-test/changeReactMentionsInput';

import IncidentActivity from 'app/views/alerts/details/activity';

describe('IncidentDetails -> Activity', function () {
  const incident = TestStubs.Incident();
  const {organization, routerContext} = initializeOrg();
  const activity = TestStubs.IncidentActivity();
  let activitiesList;

  beforeAll(function () {
    activitiesList = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${incident.identifier}/activity/`,
      body: [activity],
    });
  });

  afterAll(function () {
    MockApiClient.clearMockResponses();
  });

  const createWrapper = props =>
    mountWithTheme(
      <IncidentActivity
        params={{alertId: incident.identifier, orgId: organization.slug}}
        incident={incident}
        {...props}
      />,
      routerContext
    );

  it('fetches and renders activities', async function () {
    const wrapper = createWrapper();

    expect(activitiesList).toHaveBeenCalled();

    // loading
    expect(wrapper.find('Placeholder').length).toBeGreaterThan(0);

    await tick();
    wrapper.update();

    expect(wrapper.find('Placeholder')).toHaveLength(0);
    expect(wrapper.find('NoteBody').text().trim()).toEqual('incident activity comment');
  });

  it('creates a new note', async function () {
    const createComment = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${incident.identifier}/comments/`,
      method: 'POST',
      body: TestStubs.IncidentActivity({
        id: '234',
        comment: 'new incident comment',
      }),
    });

    const wrapper = createWrapper();

    changeReactMentionsInput(wrapper, 'new incident comment');
    wrapper.find('textarea').simulate('keyDown', {key: 'Enter', ctrlKey: true});

    await tick();
    expect(createComment).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/incidents/${incident.identifier}/comments/`,
      expect.objectContaining({data: {comment: 'new incident comment', mentions: []}})
    );
  });

  it.todo('fails to create a new note');

  it('updates an existing note', async function () {
    const newComment = 'edited comment';
    const updateComment = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${incident.identifier}/comments/${activity.id}/`,
      method: 'PUT',
      body: {
        ...activity,
        comment: newComment,
      },
    });

    const wrapper = createWrapper();

    await tick();
    // unfortunately edit/delete items are hidden until hover (using emotion)
    // so we can't simulate this in jest?
    wrapper.find('Activity').prop('onUpdateNote')(
      {
        text: newComment,
      },
      activity
    );

    await tick();

    expect(updateComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          comment: newComment,
        },
      })
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('NoteBody').text().trim()).toEqual(newComment);
  });

  it('fails to update an existing note', async function () {
    const newComment = 'edited comment';
    const updateComment = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${incident.identifier}/comments/${activity.id}/`,
      method: 'PUT',
      statusCode: 400,
    });

    const wrapper = createWrapper();

    await tick();
    // unfortunately edit/delete items are hidden until hover (using emotion)
    // so we can't simulate this in jest?
    wrapper.find('Activity').prop('onUpdateNote')(
      {
        text: newComment,
      },
      activity
    );

    await tick();

    expect(updateComment).toHaveBeenCalled();

    await tick();
    wrapper.update();

    expect(wrapper.find('NoteBody').text().trim()).toEqual('incident activity comment');
  });

  it('deletes a note', async function () {
    const deleteComment = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${incident.identifier}/comments/${activity.id}/`,
      method: 'DELETE',
      body: {},
    });

    const wrapper = createWrapper();

    await tick();
    // unfortunately edit/delete items are hidden until hover (using emotion)
    // so we can't simulate this in jest?
    wrapper.find('Activity').prop('onDeleteNote')(activity);

    await tick();

    expect(deleteComment).toHaveBeenCalled();

    await tick();
    wrapper.update();

    expect(wrapper.find('NoteBody')).toHaveLength(0);
  });

  it('fails to delete a note', async function () {
    const deleteComment = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${incident.identifier}/comments/${activity.id}/`,
      method: 'DELETE',
      statusCode: 400,
    });

    const wrapper = createWrapper();

    await tick();
    // unfortunately edit/delete items are hidden until hover (using emotion)
    // so we can't simulate this in jest?
    wrapper.find('Activity').prop('onDeleteNote')(activity);

    await tick();

    expect(deleteComment).toHaveBeenCalled();

    await tick();
    wrapper.update();

    // old note is displayed
    expect(wrapper.find('NoteBody').text().trim()).toEqual('incident activity comment');
  });
});
