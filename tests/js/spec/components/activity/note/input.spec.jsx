import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import changeReactMentionsInput from 'sentry-test/changeReactMentionsInput';

import NoteInput from 'app/components/activity/note/input';

describe('NoteInput', function() {
  const routerContext = TestStubs.routerContext();

  describe('New item', function() {
    const props = {
      group: {project: {}, id: 'groupId'},
      memberList: [],
      teams: [],
    };

    it('renders', function() {
      mountWithTheme(<NoteInput {...props} />, routerContext);
    });

    it('submits when meta + enter is pressed', function() {
      const onCreate = jest.fn();
      const wrapper = mountWithTheme(
        <NoteInput {...props} onCreate={onCreate} />,
        routerContext
      );

      const input = wrapper.find('textarea');

      input.simulate('keyDown', {key: 'Enter', metaKey: true});
      expect(onCreate).toHaveBeenCalled();
    });

    it('submits when ctrl + enter is pressed', function() {
      const onCreate = jest.fn();
      const wrapper = mountWithTheme(
        <NoteInput {...props} onCreate={onCreate} />,
        routerContext
      );

      const input = wrapper.find('textarea');

      input.simulate('keyDown', {key: 'Enter', ctrlKey: true});
      expect(onCreate).toHaveBeenCalled();
    });

    it('handles errors', async function() {
      const errorJSON = {detail: {message: '', code: 401, extra: ''}};
      const wrapper = mountWithTheme(
        <NoteInput {...props} error={!!errorJSON} errorJSON={errorJSON} />,
        routerContext
      );

      const input = wrapper.find('textarea');

      input.simulate('keyDown', {key: 'Enter', ctrlKey: true});
      wrapper.update();
      expect(wrapper.find('ErrorMessage')).toHaveLength(1);
    });
  });

  describe('Existing Item', function() {
    const defaultProps = {
      group: {project: {}, id: 'groupId'},
      modelId: 'item-id',
      text: 'an existing item',
      memberList: [],
      teams: [],
    };

    const createWrapper = props =>
      mountWithTheme(<NoteInput {...defaultProps} {...props} />, routerContext);

    it('edits existing message', async function() {
      const onUpdate = jest.fn();
      const wrapper = createWrapper({onUpdate});

      expect(
        wrapper
          .find('NoteInputNavTabLink')
          .first()
          .text()
      ).toBe('Edit');

      // Switch to preview
      wrapper
        .find('NoteInputNavTabLink')
        .last()
        .simulate('click');

      expect(wrapper.find('NotePreview').text()).toBe('an existing item\n');

      // Switch to edit
      wrapper
        .find('NoteInputNavTabLink')
        .first()
        .simulate('click');

      expect(wrapper.find('textarea').prop('value')).toBe('an existing item');

      // Can edit text
      changeReactMentionsInput(wrapper, 'new item');

      wrapper.find('textarea').simulate('keyDown', {key: 'Enter', ctrlKey: true});

      expect(onUpdate).toHaveBeenCalledWith({text: 'new item', mentions: []});
    });

    it('canels editing and moves to preview mode', async function() {
      const onEditFinish = jest.fn();
      const wrapper = createWrapper({onEditFinish});

      changeReactMentionsInput(wrapper, 'new value');

      expect(
        wrapper
          .find('FooterButton')
          .first()
          .text()
      ).toBe('Cancel');

      wrapper
        .find('FooterButton')
        .first()
        .simulate('click');

      expect(onEditFinish).toHaveBeenCalled();
    });
  });
});
