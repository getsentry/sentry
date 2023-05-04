import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';

jest.mock('sentry/utils/useProjectSdkUpdates');

const mockUseProjectSdkUpdates = useProjectSdkUpdates as jest.MockedFunction<
  typeof useProjectSdkUpdates
>;

function mockCurrentVersion(currentVersion: string) {
  mockUseProjectSdkUpdates.mockReturnValue({
    type: 'resolved',
    data: {
      projectId: TestStubs.Project().id,
      sdkName: 'javascript',
      sdkVersion: currentVersion,
      suggestions: [],
    },
  });
}
describe('useProjectSdkNeedsUpdate', () => {
  it('should return isFetching=true when sdk updates are not yet resolved', () => {
    mockUseProjectSdkUpdates.mockReturnValue({
      type: 'initial',
    });

    const {result} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      initialProps: {
        minVersion: '1.0.0',
        organization: TestStubs.Organization(),
        projectId: TestStubs.Project().id,
      },
    });
    expect(result.current.isFetching).toBeTruthy();
    expect(result.current.needsUpdate).toBeUndefined();
  });

  it('should not need an update if the sdk version is above the min version', () => {
    mockCurrentVersion('3.0.0');

    const {result} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      initialProps: {
        minVersion: '1.0.0',
        organization: TestStubs.Organization(),
        projectId: TestStubs.Project().id,
      },
    });
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.needsUpdate).toBeFalsy();
  });

  it('should be updated it the sdk version is too low', () => {
    mockCurrentVersion('3.0.0');

    const {result} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      initialProps: {
        minVersion: '8.0.0',
        organization: TestStubs.Organization(),
        projectId: TestStubs.Project().id,
      },
    });
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.needsUpdate).toBeTruthy();
  });
});
