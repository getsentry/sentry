import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Organization, Project} from 'sentry/types';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

import {DynamicSDKLoaderOption, LoaderSettings, sdkLoaderOptions} from './loaderSettings';

const dynamicSdkLoaderOptions = {
  [DynamicSDKLoaderOption.HAS_PERFORMANCE]: false,
  [DynamicSDKLoaderOption.HAS_REPLAY]: true,
  [DynamicSDKLoaderOption.HAS_DEBUG]: false,
};

const fullDynamicSdkLoaderOptions = {
  [DynamicSDKLoaderOption.HAS_PERFORMANCE]: true,
  [DynamicSDKLoaderOption.HAS_REPLAY]: true,
  [DynamicSDKLoaderOption.HAS_DEBUG]: true,
};

function renderMockRequests(
  organizationSlug: Organization['slug'],
  projectSlug: Project['slug'],
  keyId: ProjectKey['id']
) {
  const projectKeys = MockApiClient.addMockResponse({
    url: `/projects/${organizationSlug}/${projectSlug}/keys/${keyId}/`,
    method: 'PUT',
    body: TestStubs.ProjectKeys()[0],
  });

  return {projectKeys};
}

describe('Loader Script Settings', function () {
  it('allows to toggle options', async function () {
    const params = {
      projectId: '1',
      keyId: '1',
    };

    const {organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
      },
      router: {
        params,
      },
    });

    const data = {
      ...(TestStubs.ProjectKeys()[0] as ProjectKey),
      dynamicSdkLoaderOptions,
    } as ProjectKey;

    const mockRequests = renderMockRequests(
      organization.slug,
      params.projectId,
      params.keyId
    );

    render(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        projectId={params.projectId}
        projectKey={data}
      />
    );

    // SDK loader options
    for (const key of Object.keys(sdkLoaderOptions)) {
      expect(screen.getByText(sdkLoaderOptions[key].label)).toBeInTheDocument();
      const toggle = screen.getByRole('checkbox', {name: sdkLoaderOptions[key].label});
      expect(toggle).toBeEnabled();

      if (key === DynamicSDKLoaderOption.HAS_REPLAY) {
        expect(toggle).toBeChecked();
      } else {
        expect(toggle).not.toBeChecked();
      }
    }

    // Toggle performance option
    userEvent.click(
      screen.getByRole('checkbox', {
        name: sdkLoaderOptions[DynamicSDKLoaderOption.HAS_PERFORMANCE].label,
      })
    );

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectId}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: {
            dynamicSdkLoaderOptions: {
              ...dynamicSdkLoaderOptions,
              [DynamicSDKLoaderOption.HAS_PERFORMANCE]: true,
            },
          },
        })
      );
    });

    // Update SDK version
    await selectEvent.select(screen.getByText('latest'), '7.x');

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectId}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: {
            browserSdkVersion: '7.x',
          },
        })
      );
    });
  });

  it('resets performance & replay when selecting SDK version <7', async function () {
    const params = {
      projectId: '1',
      keyId: '1',
    };

    const {organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
      },
      router: {
        params,
      },
    });

    const data = {
      ...(TestStubs.ProjectKeys()[0] as ProjectKey),
      dynamicSdkLoaderOptions: fullDynamicSdkLoaderOptions,
    } as ProjectKey;

    const mockRequests = renderMockRequests(
      organization.slug,
      params.projectId,
      params.keyId
    );

    render(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        projectId={params.projectId}
        projectKey={data}
      />
    );

    // Update SDK version - should reset performance & replay
    await selectEvent.select(screen.getByText('latest'), '6.x');

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectId}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: {
            browserSdkVersion: '6.x',
            dynamicSdkLoaderOptions: {
              ...fullDynamicSdkLoaderOptions,
              [DynamicSDKLoaderOption.HAS_PERFORMANCE]: false,
              [DynamicSDKLoaderOption.HAS_REPLAY]: false,
              [DynamicSDKLoaderOption.HAS_DEBUG]: true,
            },
          },
        })
      );
    });
  });

  it('disabled performance & replay when SDK version <7 is selected', function () {
    const params = {
      projectId: '1',
      keyId: '1',
    };

    const {organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
      },
      router: {
        params,
      },
    });

    const data = {
      ...(TestStubs.ProjectKeys()[0] as ProjectKey),
      dynamicSdkLoaderOptions: {
        [DynamicSDKLoaderOption.HAS_PERFORMANCE]: false,
        [DynamicSDKLoaderOption.HAS_REPLAY]: false,
        [DynamicSDKLoaderOption.HAS_DEBUG]: true,
      },
      browserSdkVersion: '6.x',
    } as ProjectKey;

    render(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        projectId={params.projectId}
        projectKey={data}
      />
    );

    for (const key of Object.keys(sdkLoaderOptions)) {
      const toggle = screen.getByRole('checkbox', {name: sdkLoaderOptions[key].label});

      if (key === DynamicSDKLoaderOption.HAS_DEBUG) {
        expect(toggle).toBeEnabled();
        expect(toggle).toBeChecked();
      } else {
        expect(toggle).toBeDisabled();
        expect(toggle).not.toBeChecked();
      }
    }

    expect(
      screen.getAllByText('Only available in SDK version 7.x and above')
    ).toHaveLength(2);
  });

  it('shows replay message when it is enabled', function () {
    const params = {
      projectId: '1',
      keyId: '1',
    };

    const {organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
      },
      router: {
        params,
      },
    });

    const data = {
      ...(TestStubs.ProjectKeys()[0] as ProjectKey),
      dynamicSdkLoaderOptions: fullDynamicSdkLoaderOptions,
    } as ProjectKey;

    const {rerender} = render(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        projectId={params.projectId}
        projectKey={data}
      />
    );

    expect(
      screen.getByText(
        'When using Replay, the loader will load the ES6 bundle instead of the ES5 bundle.'
      )
    ).toBeInTheDocument();

    data.dynamicSdkLoaderOptions.hasReplay = false;

    rerender(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        projectId={params.projectId}
        projectKey={data}
      />
    );

    expect(
      screen.queryByText(
        'When using Replay, the loader will load the ES6 bundle instead of the ES5 bundle.'
      )
    ).not.toBeInTheDocument();
  });
});
