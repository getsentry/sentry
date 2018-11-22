import React from 'react';
import {mount} from 'enzyme';

import IssuePluginActions from 'app/components/group/issuePluginActions';

jest.mock('jquery');

describe('Vsts', function() {
  let plugin = TestStubs.VstsPlugin();
  // Note group is different than group in VstsCreate fixture
  let group = TestStubs.Group();
  let TITLE = 'input[id="id-title"]';
  let NOTES = 'textarea[id="id-description"]';
  // let WORKSPACE = '[id="id-workspace"]';
  let PROJECT = '[id="id-project"]';
  let VstsCreateResponse = TestStubs.VstsCreate();
  let createMock = jest.fn();

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/plugins/vsts/create/`,
      body: VstsCreateResponse,
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

    expect(wrapper.find(TITLE).prop('value')).toBe(
      "TypeError: Cannot read property 'secondsElapsed' of undefined"
    );
    wrapper.find(TITLE).simulate('change', {target: {value: 'Sentry Issue Title'}});
    wrapper.find(NOTES).simulate('change', {target: {value: 'Notes'}});

    wrapper.find(`input${PROJECT}`).simulate('change', {target: {value: 'b'}});
    await tick();
    wrapper.update();

    wrapper.find(`input${PROJECT}`).simulate('keyDown', {keyCode: 13});

    await tick();
    wrapper.update();

    createMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/plugins/vsts/create/`,
      body: VstsCreateResponse,
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
          project: 'b',
        }),
      })
    );
  });

  it('uses the default project', async function() {
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

    // Default value should be set
    expect(
      wrapper
        .find('Select')
        .first()
        .prop('value')
    ).toEqual('Sentry Testing Team');

    createMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/plugins/vsts/create/`,
      body: VstsCreateResponse,
    });

    wrapper.find('Modal Form').simulate('submit');
    await tick();
    wrapper.update();

    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          description:
            "https://sentry.io/sentry-billy/react/issues/590943704/\n\n```\nTypeError: Cannot read property 'secondsElapsed' of undefined\n  at value (/Users/billy/Dev/raven-js-examples/commonjs-react/dist/scripts/app.js:1:4193)\n  at r (/Users/billy/Dev/raven-js-examples/commonjs-react/dist/scripts/app.js:1:17533)\n```",
          title: "TypeError: Cannot read property 'secondsElapsed' of undefined",
          project: 'Sentry Testing Team',
        }),
      })
    );
  });

  it('can switch project to "Test"', async function() {
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

    // Default value should be set
    wrapper.find(`input${PROJECT}`).simulate('change', {target: {value: ''}});
    wrapper.find(`input${PROJECT}`).simulate('keyDown', {keyCode: 13});
    // wrapper.find('Select Option[children="Test"]').simulate('click');

    expect(
      wrapper
        .find('Select')
        .first()
        .prop('value')
    ).toEqual({label: 'Test', value: 'Test'});

    createMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/plugins/vsts/create/`,
      body: VstsCreateResponse,
    });

    wrapper.find('Modal Form').simulate('submit');
    await tick();
    wrapper.update();

    expect(createMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          description:
            "https://sentry.io/sentry-billy/react/issues/590943704/\n\n```\nTypeError: Cannot read property 'secondsElapsed' of undefined\n  at value (/Users/billy/Dev/raven-js-examples/commonjs-react/dist/scripts/app.js:1:4193)\n  at r (/Users/billy/Dev/raven-js-examples/commonjs-react/dist/scripts/app.js:1:17533)\n```",
          title: "TypeError: Cannot read property 'secondsElapsed' of undefined",
          project: 'Test',
        }),
      })
    );
  });
});
