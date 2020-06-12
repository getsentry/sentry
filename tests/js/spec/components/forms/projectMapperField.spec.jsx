import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {RenderField} from 'app/views/settings/components/forms/projectMapperField';

describe('ProjectMapperField', () => {
  let wrapper;
  const mappedDropdown = {
    placholder: 'hi',
    items: [
      {value: '1', label: 'label 1'},
      {value: '2', label: 'label 2'},
      {value: '3', label: 'label 3'},
    ],
  };

  const sentryProjects = [
    {id: 23, slug: 'cool', platform: 'javascript', name: 'Cool'},
    {id: 24, slug: 'beans', platform: 'python', name: 'Beans'},
  ];
  const existingValues = [[23, '2']];
  let onBlur, onChange;

  beforeEach(() => {
    onBlur = jest.fn();
    onChange = jest.fn();
    const props = {
      mappedDropdown,
      sentryProjects,
      value: existingValues,
      onChange,
      onBlur,
    };
    wrapper = mountWithTheme(<RenderField {...props} />, {disableLifecycleMethods: true});
  });

  it('clicking add updates values with current dropdown values', () => {
    wrapper.instance().sentryProjectRef.current = {state: {value: {value: 24}}};
    wrapper.instance().mappedRef.current = {state: {value: {value: '1'}}};
    wrapper.find('button').simulate('click');
    expect(onBlur).toHaveBeenCalledWith(
      [
        [23, '2'],
        [24, '1'],
      ],
      []
    );
    expect(onChange).toHaveBeenCalledWith(
      [
        [23, '2'],
        [24, '1'],
      ],
      []
    );
  });
});
