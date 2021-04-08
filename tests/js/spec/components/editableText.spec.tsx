import React from 'react';
import {act} from 'react-dom/test-utils';

import {mountWithTheme} from 'sentry-test/enzyme';

import EditableText from 'app/components/editableText';

export const createDocumentListenersMock = () => {
  const listeners: Record<string, any> = {};

  const handler = <K extends keyof GlobalEventHandlersEventMap>(
    eventData: Record<string, any>,
    event: K
  ) => {
    return listeners?.[event]?.(eventData);
  };

  document.addEventListener = jest.fn((event, cb) => {
    listeners[event] = cb;
  });

  document.removeEventListener = jest.fn(event => {
    delete listeners[event];
  });

  return {
    mouseDown: (domEl: HTMLElement) => handler({target: domEl}, 'mousedown'),
    keyDown: (key: KeyboardEvent['key']) => handler({key}, 'keydown'),
  };
};

describe('EditableText', function () {
  const currentValue = 'foo';
  const newValue = 'bar';
  const handleChange = jest.fn();
  const fireEvent = createDocumentListenersMock();

  it('edit value and click outside of the component', function () {
    const wrapper = mountWithTheme(
      <EditableText value={currentValue} onChange={handleChange} />
    );

    let content = wrapper.find('Content');
    expect(content.text()).toEqual(currentValue);

    let inputWrapper = wrapper.find('InputWrapper');
    expect(inputWrapper.length).toEqual(0);

    const styledIconEdit = wrapper.find('StyledIconEdit');
    expect(styledIconEdit).toBeTruthy();

    content.simulate('click');

    content = wrapper.find('Content');
    expect(inputWrapper.length).toEqual(0);

    inputWrapper = wrapper.find('InputWrapper');
    expect(inputWrapper).toBeTruthy();

    const styledInput = wrapper.find('StyledInput');
    expect(styledInput).toBeTruthy();
    styledInput.simulate('change', {target: {value: newValue}});

    const inputLabel = wrapper.find('InputLabel');
    expect(inputLabel.text()).toEqual(newValue);

    act(() => {
      // Click outside of the component
      fireEvent.mouseDown(document.body);
    });

    expect(handleChange).toHaveBeenCalled();

    wrapper.update();

    const updatedContent = wrapper.find('Content');
    expect(updatedContent).toBeTruthy();

    expect(updatedContent.text()).toEqual(newValue);
  });

  it('edit value and press enter', function () {
    const wrapper = mountWithTheme(
      <EditableText value={currentValue} onChange={handleChange} />
    );

    let content = wrapper.find('Content');
    expect(content.text()).toEqual(currentValue);

    let inputWrapper = wrapper.find('InputWrapper');
    expect(inputWrapper.length).toEqual(0);

    const styledIconEdit = wrapper.find('StyledIconEdit');
    expect(styledIconEdit).toBeTruthy();

    content.simulate('click');

    content = wrapper.find('Content');
    expect(inputWrapper.length).toEqual(0);

    inputWrapper = wrapper.find('InputWrapper');
    expect(inputWrapper).toBeTruthy();

    const styledInput = wrapper.find('StyledInput');
    expect(styledInput).toBeTruthy();
    styledInput.simulate('change', {target: {value: newValue}});

    const inputLabel = wrapper.find('InputLabel');
    expect(inputLabel.text()).toEqual(newValue);

    act(() => {
      // Press enter
      fireEvent.keyDown('Enter');
    });

    wrapper.update();

    const updatedContent = wrapper.find('Content');
    expect(updatedContent).toBeTruthy();

    expect(updatedContent.text()).toEqual(newValue);
  });
});
