import React from 'react';
import {mount} from 'enzyme';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import IncidentActivity from 'app/views/organizationIncidents/details/activity';
import changeReactMentionsInput from 'app-test/helpers/changeReactMentionsInput';

describe('IncidentDetails -> Activity', function() {
  const incident = TestStubs.Incident();
  const {organization, routerContext} = initializeOrg();

  beforeAll(function() {});

  afterAll(function() {
    MockApiClient.clearMockResponses();
  });

  const createWrapper = props =>
    mount(
      <IncidentActivity
        params={{incidentId: incident.identifier, orgId: organization.slug}}
        {...props}
      />,
      routerContext
    );

  it.todo('fetches and renders activities');
  it('creates a new note', async function() {
    const createNote = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/incidents/${
        incident.identifier
      }/comments/`,
      method: 'POST',
      body: TestStubs.IncidentActivity({
        comment: 'new incident comment',
      }),
    });

    const wrapper = createWrapper();

    changeReactMentionsInput(wrapper, 'new incident comment');
    // wrapper.find('NoteInput Button[type="submit"]').simulate('click');
    wrapper.find('textarea').simulate('keyDown', {key: 'Enter', ctrlKey: true});

    await tick();
    expect(createNote).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/incidents/${incident.identifier}/comments/`,
      expect.objectContaining({data: {comment: 'new incident comment'}})
    );
  });

  it.todo('fails to create a new note');
  it.todo('updates an existing note');
  it.todo('fails to update an existing note');
  it.todo('deletes a note');
  it.todo('fails to delete a note');
});
