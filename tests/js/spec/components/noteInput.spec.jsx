import React from 'react';
import {mount} from 'enzyme';

import NoteInput from 'app/components/activity/noteInput';
import {Client} from 'app/api';

jest.mock('app/api');

describe('NoteInput', function() {
  let spy;

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
    const wrapper = mount(
      <NoteInput group={{project: {}}} memberList={[]} sessionUser={{}} />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('submits when meta + enter is pressed', function() {
    const wrapper = mount(
      <NoteInput group={{project: {}, id: 'groupId'}} memberList={[]} sessionUser={{}} />,
      TestStubs.routerContext()
    );

    const input = wrapper.find('textarea');

    input.simulate('keyDown', {key: 'Enter', metaKey: true});
    expect(spy).toHaveBeenCalled();
  });

  it('submits when ctrl + enter is pressed', function() {
    const wrapper = mount(
      <NoteInput group={{project: {}, id: 'groupId'}} memberList={[]} sessionUser={{}} />,
      TestStubs.routerContext()
    );

    const input = wrapper.find('textarea');

    input.simulate('keyDown', {key: 'Enter', ctrlKey: true});
    expect(spy).toHaveBeenCalled();
  });

  it('handles 401 error objects', async function() {
    spy = Client.addMockResponse({
      url: '/issues/groupId/comments/',
      method: 'POST',
      body: {detail: {message: '', code: 401, extra: ''}},
      statusCode: 401,
    });
    const wrapper = mount(
      <NoteInput group={{project: {}, id: 'groupId'}} memberList={[]} sessionUser={{}} />,
      TestStubs.routerContext()
    );

    const input = wrapper.find('textarea');

    input.simulate('keyDown', {key: 'Enter', ctrlKey: true});
    wrapper.update();
    expect(wrapper.find('.activity-actions .error')).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
  });
});
