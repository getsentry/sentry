import React from 'react';

import {mount} from 'sentry-test/enzyme';

import LoadingContainer from 'app/components/loading/loadingContainer';

describe('LoadingContainer', function () {
  let wrapper;
  beforeEach(() => {
    wrapper = mount(
      <LoadingContainer>
        <div>hello!</div>
      </LoadingContainer>
    );
  });

  it('handles normal state', () => {
    expect(wrapper.text()).toBe('hello!');
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
  });

  it('handles loading state', () => {
    wrapper.setProps({isLoading: true});
    expect(wrapper.text()).toBe('hello!');
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
    wrapper.setProps({children: null});
    expect(wrapper.text()).toBe('');
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
  });

  it('handles reloading state', () => {
    wrapper.setProps({isReloading: true});
    expect(wrapper.text()).toBe('hello!');
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
    wrapper.setProps({children: null});
    expect(wrapper.text()).toBe('');
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
  });
});
