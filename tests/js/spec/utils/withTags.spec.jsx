import React from 'react';

import {mount} from 'sentry-test/enzyme';

import TagStore from 'app/stores/tagStore';
import withTags from 'app/utils/withTags';

describe('withTags HoC', function () {
  beforeEach(() => {
    TagStore.reset();
  });

  it('works', async function () {
    const MyComponent = () => null;
    const Container = withTags(MyComponent);
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
    // excludes issue tags by default
    expect(tagsProp.is).toBeUndefined();
  });
});
