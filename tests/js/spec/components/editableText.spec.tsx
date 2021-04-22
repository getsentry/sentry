import React from 'react';
import {act} from 'react-dom/test-utils';

import {createListeners} from 'sentry-test/createListeners';
import {mountWithTheme} from 'sentry-test/enzyme';

import EditableText from 'app/components/editableText';

function renderedComponent(onChange: () => void, newValue = 'bar') {
  const currentValue = 'foo';

  const wrapper = mountWithTheme(
    <EditableText value={currentValue} onChange={onChange} />
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

  return wrapper;
}

describe('EditableText', function () {
  const currentValue = 'foo';
  const newValue = 'bar';

  it('edit value and click outside of the component', function () {
    const fireEvent = createListeners('document');
    const handleChange = jest.fn();

    const wrapper = renderedComponent(handleChange);

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
    const fireEvent = createListeners('window');
    const handleChange = jest.fn();

    const wrapper = renderedComponent(handleChange);

    act(() => {
      // Press enter
      fireEvent.keyDown('Enter');
    });

    expect(handleChange).toHaveBeenCalled();

    wrapper.update();

    const updatedContent = wrapper.find('Content');
    expect(updatedContent).toBeTruthy();

    expect(updatedContent.text()).toEqual(newValue);
  });

  it('edit value and press escape', function () {
    const fireEvent = createListeners('window');
    const handleChange = jest.fn();

    const wrapper = renderedComponent(handleChange);

    act(() => {
      // Press escape
      fireEvent.keyDown('Escape');
    });

    expect(handleChange).toHaveBeenCalledTimes(0);

    wrapper.update();

    const updatedContent = wrapper.find('Content');
    expect(updatedContent).toBeTruthy();

    expect(updatedContent.text()).toEqual(currentValue);
  });

  it('clear value and show error message', function () {
    const fireEvent = createListeners('window');
    const handleChange = jest.fn();

    const wrapper = renderedComponent(handleChange, '');

    act(() => {
      // Press enter
      fireEvent.keyDown('Enter');
    });

    expect(handleChange).toHaveBeenCalledTimes(0);

    wrapper.update();

    const fieldControlErrorWrapper = wrapper.find('FieldControlErrorWrapper');
    expect(fieldControlErrorWrapper).toBeTruthy();
  });
});
