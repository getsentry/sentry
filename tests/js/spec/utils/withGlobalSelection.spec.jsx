import React from 'react';
import {mount} from 'enzyme';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import withGlobalSelection from 'app/utils/withGlobalSelection';

describe('withGlobalSelection HoC', function() {
  beforeEach(() => {
    GlobalSelectionStore.init();
  });

  it('handles projects', function() {
    const MyComponent = () => null;
    let Container = withGlobalSelection(MyComponent);
    let wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('selection').projects).toEqual([]);

    GlobalSelectionStore.updateProjects([1]);

    expect(wrapper.find('MyComponent').prop('selection').projects).toEqual([1]);
  });

  it('handles datetime', function() {
    const MyComponent = () => null;
    let Container = withGlobalSelection(MyComponent);
    let wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('selection').datetime.range).toEqual('14d');

    GlobalSelectionStore.updateDateTime({
      range: '7d',
      start: null,
      end: null,
    });

    expect(wrapper.find('MyComponent').prop('selection').datetime.range).toEqual('7d');

    GlobalSelectionStore.updateDateTime({
      range: null,
      start: '2018-08-08T00:00:00',
      end: '2018-08-08T00:00:00',
    });
  });

  it('handles environments', function() {
    const MyComponent = () => null;
    let Container = withGlobalSelection(MyComponent);
    let wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('selection').environments).toEqual([]);

    GlobalSelectionStore.updateEnvironments(['beta', 'alpha']);

    expect(wrapper.find('MyComponent').prop('selection').environments).toEqual([
      'beta',
      'alpha',
    ]);
  });
});
