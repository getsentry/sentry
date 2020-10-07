import React from 'react';

import {mount} from 'sentry-test/enzyme';

import TagStore from 'app/stores/tagStore';
import MemberListStore from 'app/stores/memberListStore';
import withIssueTags from 'app/utils/withIssueTags';

describe('withIssueTags HoC', function () {
  beforeEach(() => {
    TagStore.reset();
    MemberListStore.loadInitialData([]);
  });

  it('forwards loaded tags to the wrapped component', async function () {
    const MyComponent = () => null;
    const Container = withIssueTags(MyComponent);
    const wrapper = mount(<Container other="value" />);

    // Should forward props.
    expect(wrapper.find('MyComponent').prop('other')).toEqual('value');

    TagStore.onLoadTagsSuccess([{name: 'Mechanism', key: 'mechanism', count: 1}]);
    await wrapper.update();

    // Should forward prop
    expect(wrapper.find('MyComponent').prop('other')).toEqual('value');

    const tagsProp = wrapper.find('MyComponent').prop('tags');
    // includes custom tags
    expect(tagsProp.mechanism).toBeTruthy();

    // should include special issue and attributes.
    expect(tagsProp.is).toBeTruthy();
    expect(tagsProp.bookmarks).toBeTruthy();
    expect(tagsProp.assigned).toBeTruthy();
    expect(tagsProp['stack.filename']).toBeTruthy();
  });

  it('updates the assigned and bookmark tags with users', async function () {
    const MyComponent = () => null;
    const Container = withIssueTags(MyComponent);
    const wrapper = mount(<Container other="value" />);

    // Should forward props.
    expect(wrapper.find('MyComponent').prop('other')).toEqual('value');

    TagStore.onLoadTagsSuccess([{name: 'Mechanism', key: 'mechanism', count: 1}]);
    await wrapper.update();

    let tagsProp = wrapper.find('MyComponent').prop('tags');
    expect(tagsProp.assigned).toBeTruthy();
    expect(tagsProp.assigned.values).toEqual(['me']);

    const users = [TestStubs.User(), TestStubs.User({username: 'joe@example.com'})];
    MemberListStore.loadInitialData(users);
    await wrapper.update();

    tagsProp = wrapper.find('MyComponent').prop('tags');
    expect(tagsProp.assigned.values).toEqual([
      'me',
      'foo@example.com',
      'joe@example.com',
    ]);
    expect(tagsProp.bookmarks.values).toEqual([
      'me',
      'foo@example.com',
      'joe@example.com',
    ]);
  });
});
