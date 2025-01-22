import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';

const MOCK_ORG = OrganizationFixture();
const MOCK_PROJECT = ProjectFixture();

function wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

function mockCurrentVersion(
  mockUpdates: {
    projectId: string;
    sdkVersion: string;
  }[]
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

    const {result} = renderHook(useProjectSdkNeedsUpdate, {
      wrapper,
      initialProps: {
        minVersion: '1.0.0',
        organization: MOCK_ORG,
        projectId: [MOCK_PROJECT.id],
      },
    });

    await waitFor(() => {
      expect(result.current.isError).toBeFalsy();
    });
    await waitFor(() => {
      expect(result.current.isFetching).toBeFalsy();
    });
    expect(result.current.needsUpdate).toBeFalsy();
  });

  it('should be updated it the sdk version is too low', async () => {
    mockCurrentVersion([
      {
        projectId: MOCK_PROJECT.id,
        sdkVersion: '3.0.0',
      },
    ]);

    const {result} = renderHook(useProjectSdkNeedsUpdate, {
      wrapper,
      initialProps: {
        minVersion: '8.0.0',
        organization: MOCK_ORG,
        projectId: [MOCK_PROJECT.id],
      },
    });
    await waitFor(() => {
      expect(result.current.isError).toBeFalsy();
    });
    await waitFor(() => {
      expect(result.current.isFetching).toBeFalsy();
    });
    expect(result.current.needsUpdate).toBeTruthy();
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

    const {result} = renderHook(useProjectSdkNeedsUpdate, {
      wrapper,
      initialProps: {
        minVersion: '8.0.0',
        organization: MOCK_ORG,
        projectId: ['1', '2'],
      },
    });

    await waitFor(() => {
      expect(result.current.isError).toBeFalsy();
    });
    await waitFor(() => {
      expect(result.current.isFetching).toBeFalsy();
    });
    expect(result.current.needsUpdate).toBeTruthy();
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

    const {result} = renderHook(useProjectSdkNeedsUpdate, {
      wrapper,
      initialProps: {
        minVersion: '8.0.0',
        organization: MOCK_ORG,
        projectId: ['1', '2'],
      },
    });

    await waitFor(() => {
      expect(result.current.isError).toBeFalsy();
    });
    await waitFor(() => {
      expect(result.current.isFetching).toBeFalsy();
    });
    expect(result.current.needsUpdate).toBeFalsy();
  });
});
