import React from 'react';
import {mount} from 'sentry-test/enzyme';

import TagStore from 'app/stores/tagStore';
import withTags from 'app/utils/withTags';

describe('withTags HoC', function() {
  let organization;

  beforeEach(() => {
    organization = TestStubs.Organization();
    TagStore.reset();

    // Search bar makes this request when mounted
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [{count: 2, key: 'mechanism', name: 'Mechanism'}],
    });
  });

  it('works', async function() {
    const MyComponent = () => null;
    const Container = withTags(MyComponent);
    const wrapper = mount(<Container organization={organization} other="value" />);

    await tick();
    await tick();
    await wrapper.update();

    // Should forward props.
    expect(wrapper.find('MyComponent').prop('organization')).toBe(organization);
    expect(wrapper.find('MyComponent').prop('other')).toEqual('value');

    const tagsProp = wrapper.find('MyComponent').prop('tags');
    expect(tagsProp.mechanism).toBeTruthy();
    expect(wrapper.find('MyComponent').prop('other')).toEqual('value');
  });
});
