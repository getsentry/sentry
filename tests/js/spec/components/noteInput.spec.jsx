import React from 'react';
import {mount, shallow} from 'enzyme';

import NoteInput from 'app/components/activity/noteInput';
import {Client} from 'app/api';

jest.mock('app/api');

describe('NoteInput', function() {
  let spy;

  beforeAll(function() {
    Client.addMockResponse({
      url: '/issues/groupId/comments/',
      method: 'POST',
    });
  });

  beforeEach(function() {
    spy = jest.spyOn(Client.prototype, 'request');
  });

  afterEach(function() {
    spy.mockReset();
    spy.mockRestore();
  });

  it('renders', function() {
    let wrapper = shallow(
      <NoteInput group={{project: {}}} memberList={[]} sessionUser={{}} />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('submits when meta + enter is pressed', function() {
    let wrapper = mount(
      <NoteInput group={{project: {}, id: 'groupId'}} memberList={[]} sessionUser={{}} />,
      TestStubs.routerContext()
    );

    let input = wrapper.find('textarea');

    input.simulate('keyDown', {key: 'Enter', metaKey: true});
    expect(spy).toHaveBeenCalled();
  });

  it('submits when ctrl + enter is pressed', function() {
    let wrapper = mount(
      <NoteInput group={{project: {}, id: 'groupId'}} memberList={[]} sessionUser={{}} />,
      TestStubs.routerContext()
    );

    let input = wrapper.find('textarea');

    input.simulate('keyDown', {key: 'Enter', ctrlKey: true});
    expect(spy).toHaveBeenCalled();
  });
});
