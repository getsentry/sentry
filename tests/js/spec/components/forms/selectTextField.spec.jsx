import React from 'react';
import {mount} from 'enzyme';

import {Form, SelectTextField} from 'app/components/forms';

describe('SelectTextField', function() {
  it('can add user input into select field when using options', function() {
    let wrapper = mount(
      <SelectTextField options={[{value: 'foo', label: 'Foo'}]} name="fieldName" />
    );

    wrapper
      .find('input[id="id-fieldName"]')
      .simulate('change', {target: {value: 'bar'}})
      .simulate('keyDown', {keyCode: 13});
    wrapper.update();

    // Is selected
    expect(wrapper.find('.Select-value-label').text()).toBe('bar');

    // Is in select menu
    expect(wrapper.find('Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'bar',
        label: 'bar',
      }),
      {
        value: 'foo',
        label: 'Foo',
      },
    ]);
  });

  it('can add user input into select field when using choices', function() {
    let wrapper = mount(<SelectTextField choices={['foo']} name="fieldName" />);

    wrapper
      .find('input[id="id-fieldName"]')
      .simulate('change', {target: {value: 'bar'}})
      .simulate('keyDown', {keyCode: 13});
    wrapper.update();

    // Is selected
    expect(wrapper.find('.Select-value-label').text()).toBe('bar');

    // Is in select menu
    expect(wrapper.find('Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'bar',
        label: 'bar',
      }),
      {
        value: 'foo',
        label: 'foo',
      },
    ]);
  });

  it('can add user input into select field when using paired choices', function() {
    let wrapper = mount(<SelectTextField choices={[['foo', 'foo']]} name="fieldName" />);

    wrapper
      .find('input[id="id-fieldName"]')
      .simulate('change', {target: {value: 'bar'}})
      .simulate('keyDown', {keyCode: 13});
    wrapper.update();

    // Is selected
    expect(wrapper.find('.Select-value-label').text()).toBe('bar');

    // Is in select menu
    expect(wrapper.find('Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'bar',
        label: 'bar',
      }),
      {
        value: 'foo',
        label: 'foo',
      },
    ]);
  });

  it('with Form context', function() {
    let submitMock = jest.fn();
    let wrapper = mount(
      <Form onSubmit={submitMock}>
        <SelectTextField choices={[['foo', 'foo']]} name="fieldName" />
      </Form>,
      {}
    );

    wrapper
      .find('input[id="id-fieldName"]')
      .simulate('change', {target: {value: 'bar'}})
      .simulate('keyDown', {keyCode: 13});
    wrapper.update();

    // Is selected
    expect(wrapper.find('.Select-value-label').text()).toBe('bar');

    // Is in select menu
    expect(wrapper.find('Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'bar',
        label: 'bar',
      }),
      {
        value: 'foo',
        label: 'foo',
      },
    ]);

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
