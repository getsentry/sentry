import {ReactNode} from 'react';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';

const client = new QueryClient();

const MOCK_ORG = TestStubs.Organization();
const MOCK_PROJECT = TestStubs.Project();

function wrapper({children}: {children?: ReactNode}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockCurrentVersion(
  mockUpdates: Array<{
    projectId: string;
    sdkVersion: string;
  }>
) {
  MockApiClient.addMockResponse({
    url: `/organizations/${MOCK_ORG.slug}/sdk-updates/`,
    method: 'GET',
    body: mockUpdates.map(({projectId, sdkVersion}) => ({
      projectId,
      sdkName: 'javascript',
      sdkVersion,
      suggestions: [],
    })),
  });
}
describe('useProjectSdkNeedsUpdate', () => {
  it('should not need an update if the sdk version is above the min version', async () => {
    mockCurrentVersion([
      {
        projectId: MOCK_PROJECT.id,
        sdkVersion: '3.0.0',
      },
    ]);

    const {result, waitFor} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      wrapper,
      initialProps: {
        minVersion: '1.0.0',
        organization: MOCK_ORG,
        projectId: [MOCK_PROJECT.id],
      },
    });

    await waitFor(() => {
      expect(result.current.isError).toBeFalsy();
      expect(result.current.isFetching).toBeFalsy();
      expect(result.current.needsUpdate).toBeFalsy();
    });
  });

  it('should be updated it the sdk version is too low', async () => {
    mockCurrentVersion([
      {
        projectId: MOCK_PROJECT.id,
        sdkVersion: '3.0.0',
      },
    ]);

    const {result, waitFor} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      wrapper,
      initialProps: {
        minVersion: '8.0.0',
        organization: MOCK_ORG,
        projectId: [MOCK_PROJECT.id],
      },
    });
    await waitFor(() => {
      expect(result.current.isError).toBeFalsy();
      expect(result.current.isFetching).toBeFalsy();
      expect(result.current.needsUpdate).toBeTruthy();
    });
  });

  it('should return needsUpdate if multiple projects', async () => {
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

    const {result, waitFor} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      wrapper,
      initialProps: {
        minVersion: '8.0.0',
        organization: MOCK_ORG,
        projectId: ['1', '2'],
      },
    });

    await waitFor(() => {
      expect(result.current.isError).toBeFalsy();
      expect(result.current.isFetching).toBeFalsy();
      expect(result.current.needsUpdate).toBeTruthy();
    });
  });

  it('should not return needsUpdate if some projects meet minSdk', async () => {
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

    const {result, waitFor} = reactHooks.renderHook(useProjectSdkNeedsUpdate, {
      wrapper,
      initialProps: {
        minVersion: '8.0.0',
        organization: MOCK_ORG,
        projectId: ['1', '2'],
      },
    });

    await waitFor(() => {
      expect(result.current.isError).toBeFalsy();
      expect(result.current.isFetching).toBeFalsy();
      expect(result.current.needsUpdate).toBeFalsy();
    });
  });
});
