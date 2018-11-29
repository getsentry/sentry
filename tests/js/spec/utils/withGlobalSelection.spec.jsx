import React from 'react';
import {mount} from 'enzyme';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import withGlobalSelection from 'app/utils/withGlobalSelection';

describe('withGlobalSelection HoC', function() {
  beforeEach(() => {
    GlobalSelectionStore.init();
  });

  it('works', function() {
    const MyComponent = () => null;
    let Container = withGlobalSelection(MyComponent);
    let wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('selection')).toEqual({projects: []});

    // Update projects in store
    GlobalSelectionStore.updateProjects([1]);

    expect(wrapper.find('MyComponent').prop('selection')).toEqual({projects: [1]});
  });
});
