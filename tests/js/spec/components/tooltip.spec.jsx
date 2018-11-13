import React from 'react';
import {mount} from 'enzyme';
import Tooltip from 'app/components/tooltip';

describe('Tooltip', function() {
  it('renders', function() {
    let wrapper = mount(
      <Tooltip title="test">
        <span>My Button</span>
      </Tooltip>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('updates title', function() {
    let wrapper = mount(
      <Tooltip title="test">
        <span>My Button</span>
      </Tooltip>
    );

    wrapper.setProps({title: 'bar'});
    let tip = wrapper.find('.tip');
    expect(tip.props().title).toBe('bar');
    wrapper.setProps({title: 'baz'});
    tip = wrapper.find('.tip');
    expect(tip.props().title).toBe('baz');
  });

  it('disables and re-enables', function() {
    let wrapper = mount(
      <Tooltip title="test">
        <span>My Button</span>
      </Tooltip>
    );

    wrapper.setProps({disabled: true});
    let tip = wrapper.find('span');

    expect(tip.props().title).toBeUndefined();
    wrapper.setProps({disabled: false});

    tip = wrapper.find('.tip');
    expect(tip.props().title).toBe('test');
  });

  it('simultaneous enable and text change', function() {
    let wrapper = mount(
      <Tooltip title="test">
        <span>My Button</span>
      </Tooltip>
    );

    wrapper.setProps({disabled: true, title: 'bar'});
    let tip = wrapper.find('span');

    expect(tip.props().title).toBeUndefined();
    wrapper.setProps({disabled: false});
  });
});
