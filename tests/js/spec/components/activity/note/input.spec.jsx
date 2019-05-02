import React from 'react';
import {mount} from 'enzyme';

import NoteInput from 'app/components/activity/note/input';
import {Client} from 'app/api';

jest.mock('app/api');

describe('NoteInput', function() {
  let spy;
  const routerContext = TestStubs.routerContext();

  const props = {
    group: {project: {}, id: 'groupId'},
    memberList: [],
    teams: [],
  };

  beforeAll(function() {
    spy = Client.addMockResponse({
      url: '/issues/groupId/comments/',
      method: 'POST',
    });
  });

  beforeEach(function() {
    spy.mockReset();
  });

  it('renders', function() {
    mount(<NoteInput {...props} />, routerContext);
  });

  it('submits when meta + enter is pressed', function() {
    const onCreate = jest.fn();
    const wrapper = mount(<NoteInput {...props} onCreate={onCreate} />, routerContext);

    const input = wrapper.find('textarea');

    input.simulate('keyDown', {key: 'Enter', metaKey: true});
    expect(onCreate).toHaveBeenCalled();
  });

  it('submits when ctrl + enter is pressed', function() {
    const onCreate = jest.fn();
    const wrapper = mount(<NoteInput {...props} onCreate={onCreate} />, routerContext);

    const input = wrapper.find('textarea');

    input.simulate('keyDown', {key: 'Enter', ctrlKey: true});
    expect(onCreate).toHaveBeenCalled();
  });

  it('handles errors', async function() {
    const errorJSON = {detail: {message: '', code: 401, extra: ''}};
    const wrapper = mount(
      <NoteInput {...props} error={!!errorJSON} errorJSON={errorJSON} />,
      routerContext
    );

    const input = wrapper.find('textarea');

    input.simulate('keyDown', {key: 'Enter', ctrlKey: true});
    wrapper.update();
    expect(wrapper.find('ErrorMessage')).toHaveLength(1);
  });
});
