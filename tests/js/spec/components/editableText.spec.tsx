import {createListeners} from 'sentry-test/createListeners';
import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';

import EditableText from 'sentry/components/editableText';

const currentValue = 'foo';

function renderedComponent(onChange: () => void, newValue = 'bar', maxLength?: number) {
  const wrapper = mountWithTheme(
    <EditableText value={currentValue} onChange={onChange} maxLength={maxLength} />
  );

  let label = wrapper.find('Label');
  expect(label.text()).toEqual(currentValue);

  let inputWrapper = wrapper.find('InputWrapper');
  expect(inputWrapper.length).toEqual(0);

  const styledIconEdit = wrapper.find('IconEdit');
  expect(styledIconEdit.length).toEqual(1);

  label.simulate('click');

  label = wrapper.find('Label');
  expect(inputWrapper.length).toEqual(0);

  inputWrapper = wrapper.find('InputWrapper');
  expect(inputWrapper.length).toEqual(1);

  const styledInput = wrapper.find('StyledInput');
  expect(styledInput.length).toEqual(1);
  styledInput.simulate('change', {target: {value: newValue}});

  const inputLabel = wrapper.find('InputLabel');
  expect(inputLabel.text()).toEqual(newValue);

  return wrapper;
}

describe('EditableText', function () {
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

    const updatedLabel = wrapper.find('Label');
    expect(updatedLabel.length).toEqual(1);

    expect(updatedLabel.text()).toEqual(newValue);
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

    const updatedLabel = wrapper.find('Label');
    expect(updatedLabel.length).toEqual(1);

    expect(updatedLabel.text()).toEqual(newValue);
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
  });

  it('displays a disabled value', function () {
    const handleChange = jest.fn();

    const wrapper = mountWithTheme(
      <EditableText value={currentValue} onChange={handleChange} isDisabled />
    );

    let label = wrapper.find('Label');
    expect(label.text()).toEqual(currentValue);

    label.simulate('click');

    const inputWrapper = wrapper.find('InputWrapper');
    expect(inputWrapper.length).toEqual(0);

    label = wrapper.find('Label');
    expect(label.length).toEqual(1);
  });

  describe('revert value and close editor', function () {
    it('prop value changes', function () {
      const handleChange = jest.fn();
      const newPropValue = 'new-prop-value';

      const wrapper = renderedComponent(handleChange, '');

      wrapper.setProps({value: newPropValue});
      wrapper.update();

      const updatedLabel = wrapper.find('Label');
      expect(updatedLabel.length).toEqual(1);

      expect(updatedLabel.text()).toEqual(newPropValue);
    });

    it('prop isDisabled changes', function () {
      const handleChange = jest.fn();

      const wrapper = renderedComponent(handleChange, '');

      wrapper.setProps({isDisabled: true});
      wrapper.update();

      const updatedLabel = wrapper.find('Label');
      expect(updatedLabel.length).toEqual(1);

      expect(updatedLabel.text()).toEqual(currentValue);
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

      const updatedLabel = wrapper.find('Label');
      expect(updatedLabel.length).toEqual(1);

      expect(updatedLabel.text()).toEqual(currentValue);
    });

    it('enforces a max length if provided', function () {
      const wrapper = renderedComponent(jest.fn(), '', 4);
      const input = wrapper.find('input');
      expect(input.prop('maxLength')).toBe(4);
    });
  });
});
