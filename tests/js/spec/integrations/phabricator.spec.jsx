import React from 'react';
import {mount} from 'enzyme';

import IssuePluginActions from 'app/components/group/issuePluginActions';

jest.mock('jquery');

describe('Phabricator', function() {
  let plugin = TestStubs.PhabricatorPlugin();
  // Note group is different than group in PhabricatorCreate fixture
  let group = TestStubs.Group();
  let TITLE = 'input[id="id-title"]';
  let NOTES = 'textarea[id="id-description"]';
  let TAGS = '[id="id-tags"]';
  let ASSIGNEE = '[id="id-assignee"]';
  let PhabricatorCreateResponse = TestStubs.PhabricatorCreate();
  let autocompleteMock = jest.fn();
  let createMock = jest.fn();

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/plugins/phabricator/create/`,
      body: PhabricatorCreateResponse,
    });
    autocompleteMock = MockApiClient.addMockResponse({
      url: `/api/0/issues/${group.id}/plugins/phabricator/autocomplete`,
      body: {
        // This is a hack because our mock responses don't work properly when
        // two different fields use the same endpoint
        ...TestStubs.PhabricatorAutocomplete('tags'),
        ...TestStubs.PhabricatorAutocomplete('assignee'),
      },
    });
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterAll(function() {
    window.console.info.mockRestore();
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
    expect(wrapper.find(TITLE).prop('value')).toBe(
      'ApiException: Authentication failed, token expired!'
    );
    wrapper.find(TITLE).simulate('change', {target: {value: 'Sentry Issue Title'}});
    wrapper.find(NOTES).simulate('change', {target: {value: 'Notes'}});

    // Both tags and assignees get called
    expect(autocompleteMock).toHaveBeenCalledTimes(2);
    autocompleteMock.mockReset();

    wrapper.find(`input${TAGS}`).simulate('change', {target: {value: 'Foo'}});
    await tick();
    wrapper.update();

    expect(autocompleteMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          autocomplete_field: 'tags',
          autocomplete_query: '',
        },
      })
    );

    wrapper.find(`input${TAGS}`).simulate('keyDown', {keyCode: 13});

    // New autocomplete mock for assignee
    autocompleteMock.mockReset();
    expect(autocompleteMock).not.toHaveBeenCalled();
    // On focus/change, autocompelte gets called again
    wrapper.find(`input${ASSIGNEE}`).simulate('change', {target: {value: 'David'}});
    wrapper.find(`input${ASSIGNEE}`).simulate('change', {target: {value: 'david'}});
    await tick();
    wrapper.update();

    expect(autocompleteMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          autocomplete_field: 'assignee',
          autocomplete_query: 'David',
        },
      })
    );
    wrapper.find(`input${ASSIGNEE}`).simulate('keyDown', {keyCode: 13});

    await tick();
    wrapper.update();

    createMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/plugins/phabricator/create/`,
      body: PhabricatorCreateResponse,
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
          tags: ['PHID-PROJ-3dfrsmwmavdv4gbg4fxd'],
          assignee: 'PHID-USER-53avnyn5r6z6daqjfwdo',
        }),
      })
    );
  });
});
