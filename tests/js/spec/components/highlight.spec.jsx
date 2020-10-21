import {shallow} from 'sentry-test/enzyme';

import {HighlightComponent} from 'app/components/highlight';

describe('Highlight', function () {
  it('highlights text', function () {
    // shallow because `mount` and React Fragments don't work when accessing children
    // it will only return first child
    const wrapper = shallow(
      <HighlightComponent text="ILL">billy@sentry.io</HighlightComponent>,
      TestStubs.routerContext()
    );
    expect(wrapper.children().at(0).text()).toBe('b');
    expect(wrapper.find('span').text()).toBe('ill');
    expect(wrapper.children().at(2).text()).toBe('y@sentry.io');
  });

  it('does not have highlighted text if `text` prop is not found in main text', function () {
    // shallow because `mount` and React Fragments don't work when accessing children
    // it will only return first child
    const wrapper = shallow(
      <HighlightComponent text="invalid">billy@sentry.io</HighlightComponent>,
      TestStubs.routerContext()
    );

    expect(wrapper.text()).toBe('billy@sentry.io');
  });

  it('does not have highlighted text if `text` prop is empty', function () {
    // shallow because `mount` and React Fragments don't work when accessing children
    // it will only return first child
    const wrapper = shallow(
      <HighlightComponent text="">billy@sentry.io</HighlightComponent>,
      TestStubs.routerContext()
    );

    expect(wrapper.text()).toBe('billy@sentry.io');
  });

  it('does not have highlighted text if `disabled` prop is true', function () {
    // shallow because `mount` and React Fragments don't work when accessing children
    // it will only return first child
    const wrapper = shallow(
      <HighlightComponent text="">billy@sentry.io</HighlightComponent>,
      TestStubs.routerContext()
    );

    expect(wrapper.text()).toBe('billy@sentry.io');
  });
});
