import selectEvent from 'react-select-event';
import {ProjectKeys, ProjectKeys as ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {t} from 'sentry/locale';
import {Organization, Project, ProjectKey} from 'sentry/types';

import {KeySettings} from './keySettings';
import {LoaderSettings} from './loaderSettings';

const dynamicSdkLoaderOptions = {
  hasPerformance: false,
  hasReplay: true,
  hasDebug: false,
};

const fullDynamicSdkLoaderOptions = {
  hasPerformance: true,
  hasReplay: true,
  hasDebug: true,
};

function renderMockRequests(
  organizationSlug: Organization['slug'],
  projectSlug: Project['slug'],
  keyId: ProjectKey['id']
) {
  const projectKeys = MockApiClient.addMockResponse({
    url: `/projects/${organizationSlug}/${projectSlug}/keys/${keyId}/`,
    method: 'PUT',
    body: ProjectKeys()[0],
  });

  return {projectKeys};
}

describe('Loader Script Settings', function () {
  it('renders Loader Script Settings', function () {
    const params = {
      projectId: '1',
      keyId: '1',
    };

    const {organization, project} = initializeOrg({
      router: {
        params,
      },
    });

    const data = {
      ...ProjectKeysFixture()[0],
      dynamicSdkLoaderOptions,
    } as ProjectKey;

    const updateData = jest.fn();

    render(
      <KeySettings
        data={data}
        updateData={updateData}
        onRemove={jest.fn()}
        organization={organization}
        project={project}
        params={params}
      />
    );

    // Panel title
    expect(screen.getByText('JavaScript Loader Script')).toBeInTheDocument();

    expect(screen.getByText(t('Enable Performance Monitoring'))).toBeInTheDocument();
    expect(screen.getByText(t('Enable Session Replay'))).toBeInTheDocument();
    expect(screen.getByText(t('Enable Debug Bundles & Logging'))).toBeInTheDocument();

    const performanceCheckbox = screen.getByRole('checkbox', {
      name: t('Enable Performance Monitoring'),
    });
    expect(performanceCheckbox).toBeEnabled();
    expect(performanceCheckbox).not.toBeChecked();

    const replayCheckbox = screen.getByRole('checkbox', {
      name: t('Enable Session Replay'),
    });
    expect(replayCheckbox).toBeEnabled();
    expect(replayCheckbox).toBeChecked();

    const debugCheckbox = screen.getByRole('checkbox', {
      name: t('Enable Debug Bundles & Logging'),
    });
    expect(debugCheckbox).toBeEnabled();
    expect(debugCheckbox).not.toBeChecked();
  });

  it('allows to toggle options', async function () {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const data = {
      ...(ProjectKeysFixture()[0] as ProjectKey),
      dynamicSdkLoaderOptions,
    } as ProjectKey;

    const mockRequests = renderMockRequests(
      organization.slug,
      params.projectSlug,
      params.keyId
    );

    const updateData = jest.fn();

    render(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={data}
        updateData={updateData}
      />
    );

    // Toggle performance option
    userEvent.click(
      screen.getByRole('checkbox', {
        name: t('Enable Performance Monitoring'),
      })
    );

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            dynamicSdkLoaderOptions: {
              ...dynamicSdkLoaderOptions,
              hasPerformance: true,
            },
          }),
        })
      );
    });

    // Update SDK version
    await selectEvent.select(screen.getByText('latest'), '7.x');

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            browserSdkVersion: '7.x',
          }),
        })
      );
    });
  });

  it('resets performance & replay when selecting SDK version <7', async function () {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const data = {
      ...(ProjectKeysFixture()[0] as ProjectKey),
      dynamicSdkLoaderOptions: fullDynamicSdkLoaderOptions,
    } as ProjectKey;

    const mockRequests = renderMockRequests(
      organization.slug,
      params.projectSlug,
      params.keyId
    );

    render(
      <LoaderSettings
        updateData={jest.fn()}
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={data}
      />
    );

    // Update SDK version - should reset performance & replay
    await selectEvent.select(screen.getByText('latest'), '6.x');

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: {
            browserSdkVersion: '6.x',
            dynamicSdkLoaderOptions: {
              hasPerformance: false,
              hasReplay: false,
              hasDebug: true,
            },
          },
        })
      );
    });
  });

  it('disabled performance & replay when SDK version <7 is selected', function () {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const data = {
      ...(ProjectKeysFixture()[0] as ProjectKey),
      dynamicSdkLoaderOptions: {
        hasPerformance: false,
        hasReplay: false,
        hasDebug: true,
      },
      browserSdkVersion: '6.x',
    } as ProjectKey;

    render(
      <LoaderSettings
        updateData={jest.fn()}
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={data}
      />
    );

    const performanceCheckbox = screen.getByRole('checkbox', {
      name: t('Enable Performance Monitoring'),
    });
    expect(performanceCheckbox).not.toBeChecked();

    const replayCheckbox = screen.getByRole('checkbox', {
      name: t('Enable Session Replay'),
    });
    expect(replayCheckbox).not.toBeChecked();

    const debugCheckbox = screen.getByRole('checkbox', {
      name: t('Enable Debug Bundles & Logging'),
    });
    expect(debugCheckbox).toBeChecked();

    expect(
      screen.getAllByText('Only available in SDK version 7.x and above')
    ).toHaveLength(2);
  });

  it('shows replay message when it is enabled', function () {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const data = {
      ...(ProjectKeysFixture()[0] as ProjectKey),
      dynamicSdkLoaderOptions: fullDynamicSdkLoaderOptions,
    } as ProjectKey;

    const {rerender} = render(
      <LoaderSettings
        updateData={jest.fn()}
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={data}
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
        updateData={jest.fn()}
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={data}
      />
    );

    expect(
      screen.queryByText(
        'When using Replay, the loader will load the ES6 bundle instead of the ES5 bundle.'
      )
    ).not.toBeInTheDocument();
  });
});
