import React from 'react';
import {mount} from 'enzyme';

import IssuePluginActions from 'app/components/group/issuePluginActions';

jest.mock('jquery');

describe('Asana', function() {
  let plugin = TestStubs.AsanaPlugin();
  // Note group is different than group in AsanaCreate fixture
  let group = TestStubs.Group();
  let TITLE = 'input[id="id-title"]';
  let NOTES = 'textarea[id="id-description"]';
  // let WORKSPACE = '[id="id-workspace"]';
  let PROJECT = '[id="id-project"]';
  let ASSIGNEE = '[id="id-assignee"]';
  let AsanaCreateResponse = TestStubs.AsanaCreate();
  let autocompleteMock = jest.fn();
  let createMock = jest.fn();

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/plugins/asana/create/`,
      body: AsanaCreateResponse,
    });
    autocompleteMock = MockApiClient.addMockResponse({
      url: `/api/0/issues/${group.id}/plugins/asana/autocomplete`,
      body: {
        ...TestStubs.AsanaAutocomplete(),
        // This is a hack because our mock responses don't work properly when
        // two different fields use the same endpoint
        ...TestStubs.AsanaAutocomplete('assignee', [{id: 123123123, text: 'Billy'}]),
      },
    });
  });

  it('can create a new issue', async function() {
    let wrapper = mount(
      <IssuePluginActions plugin={plugin} />,
      TestStubs.routerContext([
        {
          group,
        },
      ])
    );

    wrapper
      .find('MenuItem a')
      .first()
      .simulate('click');

    // TODO #SELECT2 enable when replacing select2
    // expect(wrapper.find(`Select${WORKSPACE}`).prop('value')).toBe(608780875677549);
    expect(wrapper.find(TITLE).prop('value')).toBe('Error: Loading chunk 3 failed.');
    wrapper.find(TITLE).simulate('change', {target: {value: 'Sentry Issue Title'}});
    wrapper.find(NOTES).simulate('change', {target: {value: 'Notes'}});

    // Both project and assignees get called
    expect(autocompleteMock).toHaveBeenCalledTimes(2);
    autocompleteMock.mockReset();

    wrapper.find(`input${PROJECT}`).simulate('change', {target: {value: 'b'}});
    await tick();
    wrapper.update();

    expect(autocompleteMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          autocomplete_field: 'project',
          autocomplete_query: '',
        },
      })
    );

    wrapper.find(`input${PROJECT}`).simulate('keyDown', {keyCode: 13});

    // New autocomplete mock for assignee
    autocompleteMock.mockReset();
    expect(autocompleteMock).not.toHaveBeenCalled();
    // On focus/change, autocompelte gets called again
    wrapper.find(`input${ASSIGNEE}`).simulate('change', {target: {value: 'B'}});
    wrapper.find(`input${ASSIGNEE}`).simulate('change', {target: {value: 'b'}});
    await tick();
    wrapper.update();

    expect(autocompleteMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          autocomplete_field: 'assignee',
          autocomplete_query: 'B',
        },
      })
    );
    wrapper.find(`input${ASSIGNEE}`).simulate('keyDown', {keyCode: 13});

    await tick();
    wrapper.update();

    createMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/plugins/asana/create/`,
      body: AsanaCreateResponse,
    });

    wrapper.find('Modal Form').simulate('submit');
    await tick();
    wrapper.update();

    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Notes',
          title: 'Sentry Issue Title',
          workspace: 608780875677549,
          project: 724210387969378,
          assignee: 123123123,
        }),
      })
    );
  });
});
