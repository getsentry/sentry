import React from 'react';

import {mount} from 'sentry-test/enzyme';

import withExperiment from 'app/utils/withExperiment';
import ConfigStore from 'app/stores/configStore';
import {logExperiment} from 'app/utils/analytics';

jest.mock('app/utils/analytics', () => ({
  logExperiment: jest.fn(),
}));

jest.mock('app/data/experimentConfig', () => ({
  experimentConfig: {
    orgExperiment: {
      key: 'orgExperiment',
      type: 'organization',
      parameter: 'exposed',
      assignments: [1, 0, -1],
    },
    userExperiment: {
      key: 'userExperiment',
      type: 'user',
      parameter: 'exposed',
      assignments: [1, 0, -1],
    },
  },
}));

describe('withConfig HoC', function () {
  beforeEach(function () {
    jest.clearAllMocks();
  });

  const organization = {
    id: 1,
    experiments: {orgExperiment: 1},
  };

  const MyComponent = () => null;

  it('injects org experiment assignment', function () {
    const Container = withExperiment(MyComponent, {experiment: 'orgExperiment'});
    const wrapper = mount(<Container organization={organization} />);

    expect(wrapper.find('MyComponent').prop('experimentAssignment')).toEqual(1);
  });

  it('injects user experiment assignment', function () {
    ConfigStore.set('user', {id: 123, experiments: {userExperiment: 2}});

    const Container = withExperiment(MyComponent, {experiment: 'userExperiment'});
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('experimentAssignment')).toEqual(2);
  });

  it('logs experiment assignment', function () {
    const Container = withExperiment(MyComponent, {experiment: 'orgExperiment'});
    mount(<Container organization={organization} />);

    expect(logExperiment).toHaveBeenCalledWith({key: 'orgExperiment', organization});
  });

  it('defers logging when injectLogExperiment is true', function () {
    const Container = withExperiment(MyComponent, {
      experiment: 'orgExperiment',
      injectLogExperiment: true,
    });
    const wrapper = mount(<Container organization={organization} />);

    expect(logExperiment).not.toHaveBeenCalled();

    // Call log experiment and verify it was called
    wrapper.find('MyComponent').prop('logExperiment')();
    expect(logExperiment).toHaveBeenCalledWith({key: 'orgExperiment', organization});
  });
});
