import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';

jest.mock('sentry/utils/useProjectSdkUpdates');

const mockUseProjectSdkUpdates = useProjectSdkUpdates as jest.MockedFunction<
  typeof useProjectSdkUpdates
>;

function mockCurrentVersion(
  mockUpdates: Array<{
    projectId: string;
    sdkVersion: string;
  }>
) {
  mockUseProjectSdkUpdates.mockReturnValue({
    type: 'resolved',
    // @ts-expect-error the return type is overloaded and ts seems to want the first return type of ProjectSdkUpdate
    data: mockUpdates.map(({projectId, sdkVersion}) => ({
      projectId,
      sdkName: 'javascript',
      sdkVersion,
      suggestions: [],
    })),
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
        projectId: [TestStubs.Project().id],
      },
    });
    expect(result.current.isFetching).toBeTruthy();
    expect(result.current.needsUpdate).toBeUndefined();
  });

  it('should not need an update if the sdk version is above the min version', () => {
    mockCurrentVersion([
      {
        projectId: TestStubs.Project().id,
        sdkVersion: '3.0.0',
      },
    ]);

    const {result} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      initialProps: {
        minVersion: '1.0.0',
        organization: TestStubs.Organization(),
        projectId: [TestStubs.Project().id],
      },
    });
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.needsUpdate).toBeFalsy();
  });

  it('should be updated it the sdk version is too low', () => {
    mockCurrentVersion([
      {
        projectId: TestStubs.Project().id,
        sdkVersion: '3.0.0',
      },
    ]);

    const {result} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      initialProps: {
        minVersion: '8.0.0',
        organization: TestStubs.Organization(),
        projectId: [TestStubs.Project().id],
      },
    });
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.needsUpdate).toBeTruthy();
  });

  it('should return needsUpdate if multiple projects', () => {
    mockCurrentVersion([
      {
        projectId: '1',
        sdkVersion: '3.0.0',
      },
      {
        projectId: '2',
        sdkVersion: '3.0.0',
      },
    ]);

    const {result} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      initialProps: {
        minVersion: '8.0.0',
        organization: TestStubs.Organization(),
        projectId: ['1', '2'],
      },
    });
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.needsUpdate).toBeTruthy();
  });

  it('should not return needsUpdate if some projects meet minSdk', () => {
    mockCurrentVersion([
      {
        projectId: '1',
        sdkVersion: '8.0.0',
      },
      {
        projectId: '2',
        sdkVersion: '3.0.0',
      },
    ]);

    const {result} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      initialProps: {
        minVersion: '8.0.0',
        organization: TestStubs.Organization(),
        projectId: ['1', '2'],
      },
    });
    expect(result.current.isFetching).toBeFalsy();
    expect(result.current.needsUpdate).toBeFalsy();
  });
});
