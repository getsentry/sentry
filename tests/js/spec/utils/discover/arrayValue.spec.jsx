import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ArrayValue from 'app/utils/discover/arrayValue';

describe('Discover > ArrayValue', function () {
  it('renders an expand link', function () {
    const wrapper = mountWithTheme(<ArrayValue value={['one', 'two', 'three']} />);

    // Should have a button
    const button = wrapper.find('button');
    expect(button).toHaveLength(1);
    expect(button.text()).toEqual('[+2 more]');

    // Should show last value.
    expect(wrapper.text()).toContain('three');
  });

  it('renders all elements when expanded', function () {
    const wrapper = mountWithTheme(<ArrayValue value={['one', 'two', 'three']} />);

    // Should have a button
    let button = wrapper.find('button');
    button.simulate('click');

    wrapper.update();

    // Button text should update.
    button = wrapper.find('button');
    expect(button.text()).toEqual('[collapse]');

    // Should show all values.
    const text = wrapper.text();
    expect(text).toContain('three');
    expect(text).toContain('two');
    expect(text).toContain('one');
  });

  it('hides toggle on 1 element', function () {
    const wrapper = mountWithTheme(<ArrayValue value={['one']} />);

    expect(wrapper.find('button')).toHaveLength(0);
    const text = wrapper.text();
    expect(text).toContain('one');
  });

  it('hides toggle on 0 elements', function () {
    const wrapper = mountWithTheme(<ArrayValue value={[]} />);

    expect(wrapper.find('button')).toHaveLength(0);
  });
});
