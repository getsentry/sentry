import {mountWithTheme} from 'sentry-test/enzyme';
import {changeInputValue, openMenu} from 'sentry-test/select-new';

import {Form, SelectCreatableField} from 'sentry/components/deprecatedforms';

describe('SelectCreatableField', function () {
  it('can add user input into select field when using options', function () {
    const wrapper = mountWithTheme(
      <SelectCreatableField options={[{value: 'foo', label: 'Foo'}]} name="fieldName" />
    );

    const input = wrapper.find('SelectControl input[type="text"]');
    changeInputValue(input, 'bar');
    wrapper.update();

    // Text is in input
    expect(wrapper.find('SelectControl input[type="text"]').props().value).toBe('bar');

    // Click on create option
    openMenu(wrapper, {control: true});
    wrapper.find('SelectControl Option Label').simulate('click');

    // Is active hidden input value
    expect(wrapper.find('SelectControl input[type="hidden"]').props().value).toEqual(
      'bar'
    );
  });

  it('can add user input into select field when using choices', function () {
    const wrapper = mountWithTheme(
      <SelectCreatableField choices={['foo']} name="fieldName" />
    );

    const input = wrapper.find('SelectControl input[type="text"]');
    changeInputValue(input, 'bar');
    wrapper.update();

    // Text is in input
    expect(wrapper.find('SelectControl input[type="text"]').props().value).toBe('bar');

    // Click on create option
    openMenu(wrapper, {control: true});
    wrapper.find('SelectControl Option Label').simulate('click');

    // Is active hidden input value
    expect(wrapper.find('SelectControl input[type="hidden"]').props().value).toEqual(
      'bar'
    );
  });

  it('can add user input into select field when using paired choices', function () {
    const wrapper = mountWithTheme(
      <SelectCreatableField choices={[['foo', 'foo']]} name="fieldName" />
    );

    const input = wrapper.find('SelectControl input[type="text"]');
    changeInputValue(input, 'bar');
    wrapper.update();

    // Text is in input
    expect(wrapper.find('SelectControl input[type="text"]').props().value).toBe('bar');

    // Click on create option
    openMenu(wrapper, {control: true});
    wrapper.find('SelectControl Option Label').simulate('click');

    // Is active hidden input value
    expect(wrapper.find('SelectControl input[type="hidden"]').props().value).toEqual(
      'bar'
    );
  });

  it('with Form context', function () {
    const submitMock = jest.fn();
    const wrapper = mountWithTheme(
      <Form onSubmit={submitMock}>
        <SelectCreatableField choices={[['foo', 'foo']]} name="fieldName" />
      </Form>,
      {}
    );

    const input = wrapper.find('SelectControl input[type="text"]');
    changeInputValue(input, 'bar');
    wrapper.update();

    // Text is in input
    expect(wrapper.find('SelectControl input[type="text"]').props().value).toBe('bar');

    // Click on create option
    openMenu(wrapper, {control: true});
    wrapper.find('SelectControl Option Label').simulate('click');

    wrapper.find('Form').simulate('submit');
    expect(submitMock).toHaveBeenCalledWith(
      {
        fieldName: 'bar',
      },
      expect.anything(),
      expect.anything()
    );
  });
});
