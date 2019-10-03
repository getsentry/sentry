import React from 'react';
import {mount} from 'enzyme';

import DiscoverSavedQueriesStore from 'app/stores/discoverSavedQueriesStore';
import withDiscoverSavedQueries from 'app/utils/withDiscoverSavedQueries';

describe('withDiscoverSavedQueries HoC', function() {
  beforeEach(() => {
    DiscoverSavedQueriesStore.reset();
  });

  it('works', function() {
    const MyComponent = () => null;
    const Container = withDiscoverSavedQueries(MyComponent);
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('savedQueries')).toEqual([]);

    // Insert into the store
    const query = {
      id: '1',
      version: 2,
      fields: ['title', 'count()'],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
    };
    DiscoverSavedQueriesStore.fetchSavedQueriesSuccess([query]);

    wrapper.update();
    const props = wrapper.find('MyComponent').prop('savedQueries');
    expect(props).toHaveLength(1);
    expect(props[0].id).toBe(query.id);
  });

  it('filters out versionless queries', function() {
    const MyComponent = () => null;
    const Container = withDiscoverSavedQueries(MyComponent);
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('savedQueries')).toEqual([]);

    // Insert into the store
    const query = {
      id: '1',
      fields: ['title', 'count()'],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
    };
    DiscoverSavedQueriesStore.fetchSavedQueriesSuccess([query]);

    wrapper.update();
    const props = wrapper.find('MyComponent').prop('savedQueries');
    expect(props).toHaveLength(0);
  });
});
