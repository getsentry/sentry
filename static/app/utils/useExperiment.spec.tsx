import {reactHooks} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import * as analytics from 'sentry/utils/analytics';
import {useExperiment} from 'sentry/utils/useExperiment';
import * as useOrganization from 'sentry/utils/useOrganization';

jest.mock('sentry/data/experimentConfig', () => ({
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

describe('useExperiment', function () {
  const organization = TestStubs.Organization({
    id: 1,
    experiments: {orgExperiment: 1},
  });

  beforeEach(function () {
    jest.clearAllMocks();
    jest.spyOn(useOrganization, 'default').mockReturnValue(organization);
  });

  it('injects org experiment assignment', function () {
    const {result} = reactHooks.renderHook(useExperiment, {
      initialProps: 'orgExperiment',
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        experimentAssignment: 1,
      })
    );
  });

  it('injects user experiment assignment', function () {
    ConfigStore.set('user', TestStubs.User({id: 123, experiments: {userExperiment: 2}}));
    const {result} = reactHooks.renderHook(useExperiment, {
      initialProps: 'userExperiment',
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        experimentAssignment: 2,
      })
    );
  });

  it('logs experiment assignment', function () {
    const logExperimentSpy = jest.spyOn(analytics, 'logExperiment').mockReturnValue();
    reactHooks.renderHook(useExperiment, {
      initialProps: 'orgExperiment',
    });

    expect(logExperimentSpy).toHaveBeenCalledWith({key: 'orgExperiment', organization});
  });

  it('defers logging when logExperimentOnMount is true', function () {
    const logExperimentSpy = jest.spyOn(analytics, 'logExperiment').mockReturnValue();
    const {result} = reactHooks.renderHook(
      (args: Parameters<typeof useExperiment>) => useExperiment(args[0], args[1]),
      {initialProps: ['orgExperiment', {logExperimentOnMount: false}]}
    );

    expect(logExperimentSpy).not.toHaveBeenCalled();

    result.current.logExperiment();

    expect(logExperimentSpy).toHaveBeenCalledWith({key: 'orgExperiment', organization});
  });
});
