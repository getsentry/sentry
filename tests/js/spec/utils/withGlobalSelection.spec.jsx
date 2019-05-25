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
    const Container = withGlobalSelection(MyComponent);
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('selection').projects).toEqual([]);

    GlobalSelectionStore.updateProjects([1]);
    wrapper.update();

    expect(wrapper.find('MyComponent').prop('selection').projects).toEqual([1]);
  });

  it('handles datetime', function() {
    let selection;
    const MyComponent = () => null;
    const Container = withGlobalSelection(MyComponent);
    const wrapper = mount(<Container />);

    selection = wrapper.find('MyComponent').prop('selection');
    expect(selection.datetime.period).toEqual(null);
    expect(selection.datetime.start).toEqual(null);
    expect(selection.datetime.end).toEqual(null);

    GlobalSelectionStore.updateDateTime({
      period: '7d',
      start: null,
      end: null,
    });
    wrapper.update();

    selection = wrapper.find('MyComponent').prop('selection');
    expect(selection.datetime.period).toEqual('7d');
    expect(selection.datetime.start).toEqual(null);
    expect(selection.datetime.end).toEqual(null);

    GlobalSelectionStore.updateDateTime({
      period: null,
      start: '2018-08-08T00:00:00',
      end: '2018-08-08T00:00:00',
    });
    wrapper.update();

    selection = wrapper.find('MyComponent').prop('selection');
    expect(selection.datetime.period).toEqual(null);
    expect(selection.datetime.start).toEqual('2018-08-08T00:00:00');
    expect(selection.datetime.end).toEqual('2018-08-08T00:00:00');
  });

  it('handles environments', function() {
    const MyComponent = () => null;
    const Container = withGlobalSelection(MyComponent);
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('selection').environments).toEqual([]);

    GlobalSelectionStore.updateEnvironments(['beta', 'alpha']);
    wrapper.update();

    expect(wrapper.find('MyComponent').prop('selection').environments).toEqual([
      'beta',
      'alpha',
    ]);
  });
});
