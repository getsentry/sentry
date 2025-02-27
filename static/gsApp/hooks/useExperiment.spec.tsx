import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import * as useOrganization from 'sentry/utils/useOrganization';

import {useExperiment} from 'getsentry/hooks/useExperiment';
import * as logExperiment from 'getsentry/utils/logExperiment';

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
  const organization = OrganizationFixture({
    id: '1',
    experiments: {
      // @ts-expect-error: Using mock keys
      orgExperiment: 1,
    },
  });

  beforeEach(function () {
    jest.clearAllMocks();
    jest.spyOn(useOrganization, 'default').mockReturnValue(organization);
    jest.spyOn(logExperiment, 'default').mockResolvedValue();
  });

  it('injects org experiment assignment', function () {
    const {result} = renderHook(useExperiment, {
      initialProps: 'orgExperiment' as any, // Cast to any because this doesn't exist in the config types
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        experimentAssignment: 1,
      })
    );
  });

  it('injects user experiment assignment', function () {
    ConfigStore.set('user', UserFixture({id: '123', experiments: {userExperiment: 2}}));
    const {result} = renderHook(useExperiment, {
      initialProps: 'userExperiment' as any,
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        experimentAssignment: 2,
      })
    );
  });

  it('logs experiment assignment', function () {
    const logExperimentSpy = jest.spyOn(logExperiment, 'default').mockResolvedValue();
    renderHook(useExperiment, {
      initialProps: 'orgExperiment' as any,
    });

    expect(logExperimentSpy).toHaveBeenCalledWith({key: 'orgExperiment', organization});
  });

  it('defers logging when logExperimentOnMount is true', function () {
    const logExperimentSpy = jest.spyOn(logExperiment, 'default').mockResolvedValue();
    const {result} = renderHook(
      (args: Parameters<typeof useExperiment>) => useExperiment(args[0], args[1]),
      {initialProps: ['orgExperiment' as any, {logExperimentOnMount: false}]}
    );

    expect(logExperimentSpy).not.toHaveBeenCalled();

    result.current.logExperiment();

    expect(logExperimentSpy).toHaveBeenCalledWith({key: 'orgExperiment', organization});
  });
});
