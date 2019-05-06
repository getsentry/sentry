import React from 'react';
import {mount} from 'enzyme';

import changeReactMentionsInput from 'app-test/helpers/changeReactMentionsInput';

import NoteInputWithStorage from 'app/components/activity/note/inputWithStorage';
import localStorage from 'app/utils/localStorage';

jest.mock('app/utils/localStorage');

describe('NoteInputWithStorage', function() {
  const defaultProps = {
    storageKey: 'storage',
    itemKey: 'item1',
    group: {project: {}, id: 'groupId'},
    memberList: [],
    teams: [],
  };
  const routerContext = TestStubs.routerContext();

  const createWrapper = props => {
    return mount(<NoteInputWithStorage {...defaultProps} {...props} />, routerContext);
  };

  it('loads draft item from local storage when mounting', function() {
    localStorage.getItem.mockImplementation(() => JSON.stringify({item1: 'saved item'}));

    const wrapper = createWrapper();

    expect(localStorage.getItem).toHaveBeenCalledWith('storage');
    expect(wrapper.find('textarea').prop('value')).toBe('saved item');
  });

  it('saves draft when input changes', function() {
    const wrapper = createWrapper();

    changeReactMentionsInput(wrapper, 'WIP COMMENT');

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'storage',
      JSON.stringify({item1: 'WIP COMMENT'})
    );
  });

  it('removes draft item after submitting', function() {
    localStorage.getItem.mockImplementation(() =>
      JSON.stringify({item1: 'draft item', item2: 'item2', item3: 'item3'})
    );

    const wrapper = createWrapper();

    changeReactMentionsInput(wrapper, 'new comment');

    wrapper.find('textarea').simulate('keyDown', {key: 'Enter', ctrlKey: true});
    expect(localStorage.setItem).toHaveBeenLastCalledWith(
      'storage',
      JSON.stringify({item2: 'item2', item3: 'item3'})
    );
  });
});
