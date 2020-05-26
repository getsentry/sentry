import React from 'react';

import {mount} from 'sentry-test/enzyme';

import Hook from 'app/components/hook';
import HookStore from 'app/stores/hookStore';

describe('Hook', function() {
  const Wrapper = function Wrapper(props) {
    return <div {...props} />;
  };
  const routerContext = TestStubs.routerContext();

  beforeEach(function() {
    HookStore.add('footer', ({organization} = {}) => (
      <Wrapper key="initial" organization={organization}>
        {organization.slug}
      </Wrapper>
    ));
  });

  afterEach(function() {
    // Clear HookStore
    HookStore.init();
  });

  it('renders component from a hook', function() {
    const wrapper = mount(
      <div>
        <Hook name="footer" organization={TestStubs.Organization()} />
      </div>,
      routerContext
    );

    expect(HookStore.hooks.footer).toHaveLength(1);
    expect(wrapper.find('Wrapper')).toHaveLength(1);
    expect(wrapper.find('Wrapper').prop('organization').slug).toBe('org-slug');
  });

  it('renders an invalid hook', function() {
    const wrapper = mount(
      <div>
        <Hook name="invalid-hook" organization={TestStubs.Organization()} />
      </div>,
      routerContext
    );

    expect(wrapper.find('Wrapper')).toHaveLength(0);
    expect(wrapper.find('div')).toHaveLength(1);
  });

  it('can re-render when hooks get after initial render', function() {
    const wrapper = mount(
      <div>
        <Hook name="footer" organization={TestStubs.Organization()} />
      </div>,
      routerContext
    );

    expect(wrapper.find('Wrapper')).toHaveLength(1);

    HookStore.add('footer', () => (
      <Wrapper key="new" organization={null}>
        New Hook
      </Wrapper>
    ));

    wrapper.update();

    expect(HookStore.hooks.footer).toHaveLength(2);
    expect(wrapper.find('Wrapper')).toHaveLength(2);
    expect(
      wrapper
        .find('Wrapper')
        .at(1)
        .prop('organization')
    ).toEqual(null);
  });

  it('can use children as a render prop', function() {
    const wrapper = mount(
      <div>
        <Hook name="footer" organization={TestStubs.Organization()}>
          {({hooks}) => hooks.map((hook, i) => <Wrapper key={i}>{hook}</Wrapper>)}
        </Hook>
      </div>,
      routerContext
    );

    HookStore.add('footer', () => (
      <Wrapper key="new" organization={null}>
        New Hook
      </Wrapper>
    ));

    wrapper.update();

    // Has 2 Wrappers from store, and each is wrapped by another Wrapper
    expect(wrapper.find('Wrapper')).toHaveLength(4);
  });
});
