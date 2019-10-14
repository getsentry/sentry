import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import {Form, SelectCreatableField} from 'app/components/forms';

describe('SelectCreatableField', function() {
  it('can add user input into select field when using options', function() {
    const wrapper = mountWithTheme(
      <SelectCreatableField options={[{value: 'foo', label: 'Foo'}]} name="fieldName" />,
      TestStubs.routerContext()
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
    const wrapper = mountWithTheme(
      <SelectCreatableField choices={['foo']} name="fieldName" />,
      TestStubs.routerContext()
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
  });

  it('can add user input into select field when using paired choices', function() {
    const wrapper = mountWithTheme(
      <SelectCreatableField choices={[['foo', 'foo']]} name="fieldName" />,
      TestStubs.routerContext()
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
  });

  it('with Form context', function() {
    const submitMock = jest.fn();
    const wrapper = mountWithTheme(
      <Form onSubmit={submitMock}>
        <SelectCreatableField choices={[['foo', 'foo']]} name="fieldName" />
      </Form>,
      TestStubs.routerContext()
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

    // SelectControl should have the value object, not just a simple value
    expect(wrapper.find('SelectControl').prop('value')).toEqual(
      expect.objectContaining({
        value: 'bar',
        label: 'bar',
      })
    );

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
