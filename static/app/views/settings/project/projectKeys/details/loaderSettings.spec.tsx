import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';

import {KeySettings} from './keySettings';
import {LoaderSettings} from './loaderSettings';

const dynamicSdkLoaderOptions = {
  hasDebug: false,
  hasFeedback: false,
  hasPerformance: false,
  hasReplay: true,
  hasLogsAndMetrics: false,
};

const fullDynamicSdkLoaderOptions = {
  hasDebug: true,
  hasFeedback: true,
  hasPerformance: true,
  hasReplay: true,
  hasLogsAndMetrics: false,
};

function renderMockRequests(
  organizationSlug: Organization['slug'],
  projectSlug: Project['slug'],
  keyId: ProjectKey['id']
) {
  const projectKeys = MockApiClient.addMockResponse({
    url: `/projects/${organizationSlug}/${projectSlug}/keys/${keyId}/`,
    method: 'PUT',
    body: ProjectKeysFixture()[0],
  });

  return {projectKeys};
}

describe('Loader Script Settings', () => {
  it('renders Loader Script Settings', () => {
    const params = {
      projectId: '1',
      keyId: '1',
    };

    const {organization, project} = initializeOrg();

    const updateData = jest.fn();

    render(
      <KeySettings
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions,
        }}
        updateData={updateData}
        onRemove={jest.fn()}
        organization={organization}
        project={project}
        params={params}
      />
    );

    // Panel title
    expect(screen.getByText('JavaScript Loader Script')).toBeInTheDocument();

    expect(screen.getByText('Enable Performance Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Enable Session Replay')).toBeInTheDocument();
    expect(screen.getByText('Enable User Feedback')).toBeInTheDocument();
    expect(screen.getByText('Enable SDK debugging')).toBeInTheDocument();

    const performanceCheckbox = screen.getByRole('checkbox', {
      name: 'Enable Performance Monitoring',
    });
    expect(performanceCheckbox).toBeEnabled();
    expect(performanceCheckbox).not.toBeChecked();

    const replayCheckbox = screen.getByRole('checkbox', {
      name: 'Enable Session Replay',
    });
    expect(replayCheckbox).toBeEnabled();
    expect(replayCheckbox).toBeChecked();

    const feedbackCheckbox = screen.getByRole('checkbox', {
      name: 'Enable User Feedback',
    });
    expect(feedbackCheckbox).toBeEnabled();
    expect(feedbackCheckbox).not.toBeChecked();

    const debugCheckbox = screen.getByRole('checkbox', {
      name: 'Enable SDK debugging',
    });
    expect(debugCheckbox).toBeEnabled();
    expect(debugCheckbox).not.toBeChecked();
  });

  it('allows to toggle options', async () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

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
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions,
        }}
        updateData={updateData}
      />
    );

    // Toggle performance option
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'Enable Performance Monitoring',
      })
    );

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: {dynamicSdkLoaderOptions: {hasPerformance: true}},
        })
      );
    });

    // Update SDK version
    await selectEvent.select(screen.getByText('7.x'), '6.x');

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: expect.objectContaining({
            browserSdkVersion: '6.x',
          }),
        })
      );
    });
  });

  it('resets performance & replay when selecting SDK version <7', async () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

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
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions: fullDynamicSdkLoaderOptions,
        }}
      />
    );

    // Update SDK version - should reset performance & replay
    await selectEvent.select(screen.getByText('7.x'), '6.x');

    await waitFor(() => {
      expect(mockRequests.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: {
            browserSdkVersion: '6.x',
            dynamicSdkLoaderOptions: {
              hasDebug: true,
              hasFeedback: false,
              hasPerformance: false,
              hasReplay: false,
              hasLogsAndMetrics: false,
            },
          },
        })
      );
    });
  });

  it('disabled performance, replay & feedback when SDK version <7 is selected', () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    render(
      <LoaderSettings
        updateData={jest.fn()}
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions: {
            hasDebug: true,
            hasFeedback: false,
            hasPerformance: false,
            hasReplay: false,
            hasLogsAndMetrics: false,
          },
          browserSdkVersion: '6.x',
        }}
      />
    );

    const performanceCheckbox = screen.getByRole('checkbox', {
      name: 'Enable Performance Monitoring',
    });
    expect(performanceCheckbox).not.toBeChecked();

    const replayCheckbox = screen.getByRole('checkbox', {
      name: 'Enable Session Replay',
    });
    expect(replayCheckbox).not.toBeChecked();

    const feedbackCheckbox = screen.getByRole('checkbox', {
      name: 'Enable User Feedback',
    });
    expect(feedbackCheckbox).not.toBeChecked();

    const debugCheckbox = screen.getByRole('checkbox', {
      name: 'Enable SDK debugging',
    });
    expect(debugCheckbox).toBeChecked();

    expect(
      screen.getAllByText('Only available in SDK version 7.x and above')
    ).toHaveLength(3);
  });

  it('shows replay message when it is enabled', () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const data: ProjectKey = {
      ...ProjectKeysFixture()[0],
      dynamicSdkLoaderOptions: fullDynamicSdkLoaderOptions,
    };

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
        'When using Replay, the loader will load the ES6 bundle instead of the ES5 bundle.',
        {exact: false}
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
        'When using Replay, the loader will load the ES6 bundle instead of the ES5 bundle.',
        {exact: false}
      )
    ).not.toBeInTheDocument();
  });

  it('calls updateData on successful toggle', async () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const data: ProjectKey = {
      ...ProjectKeysFixture()[0],
      dynamicSdkLoaderOptions,
    };

    const responseBody = {
      ...data,
      dynamicSdkLoaderOptions: {...dynamicSdkLoaderOptions, hasDebug: true},
    };

    const putMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
      method: 'PUT',
      body: responseBody,
    });

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

    await userEvent.click(screen.getByRole('checkbox', {name: 'Enable SDK debugging'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(updateData).toHaveBeenCalled();
    });
  });

  it('sends correct payload when toggling debug', async () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const mockRequest = renderMockRequests(
      organization.slug,
      params.projectSlug,
      params.keyId
    );

    render(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions,
        }}
        updateData={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('checkbox', {name: 'Enable SDK debugging'}));

    await waitFor(() => {
      expect(mockRequest.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: {dynamicSdkLoaderOptions: {hasDebug: true}},
        })
      );
    });
  });

  it('sends correct payload when toggling replay', async () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const mockRequest = renderMockRequests(
      organization.slug,
      params.projectSlug,
      params.keyId
    );

    render(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions,
        }}
        updateData={jest.fn()}
      />
    );

    // replay is already true in dynamicSdkLoaderOptions, toggling it off
    await userEvent.click(screen.getByRole('checkbox', {name: 'Enable Session Replay'}));

    await waitFor(() => {
      expect(mockRequest.projectKeys).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`,
        expect.objectContaining({
          data: {dynamicSdkLoaderOptions: {hasReplay: false}},
        })
      );
    });
  });

  it('only sends the changed field so concurrent toggles do not clobber each other', async () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const mockRequest = renderMockRequests(
      organization.slug,
      params.projectSlug,
      params.keyId
    );

    render(
      <LoaderSettings
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions,
        }}
        updateData={jest.fn()}
      />
    );

    const url = `/projects/${organization.slug}/${params.projectSlug}/keys/${params.keyId}/`;

    // Toggle two different options back-to-back, before the parent re-renders
    // with fresh data. Each request must carry ONLY its own changed field —
    // otherwise the slower-resolving request would overwrite the other's
    // change with a stale value (the backend merges partial options).
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Enable Performance Monitoring'})
    );
    await userEvent.click(screen.getByRole('checkbox', {name: 'Enable SDK debugging'}));

    await waitFor(() => {
      expect(mockRequest.projectKeys).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          data: {dynamicSdkLoaderOptions: {hasPerformance: true}},
        })
      );
    });

    expect(mockRequest.projectKeys).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {dynamicSdkLoaderOptions: {hasDebug: true}},
      })
    );
  });

  it('disables logs and metrics for SDK versions below 10.x', () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    render(
      <LoaderSettings
        updateData={jest.fn()}
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions: fullDynamicSdkLoaderOptions,
          browserSdkVersion: '7.x',
        }}
      />
    );

    const logsCheckbox = screen.getByRole('checkbox', {
      name: 'Enable Logs and Metrics',
    });
    expect(logsCheckbox).toBeDisabled();
    expect(logsCheckbox).not.toBeChecked();

    expect(
      screen.getByText('Only available in SDK version 10.x and above')
    ).toBeInTheDocument();
  });

  it('enables logs and metrics for SDK version 10.x', () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    render(
      <LoaderSettings
        updateData={jest.fn()}
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={{
          ...ProjectKeysFixture()[0],
          dynamicSdkLoaderOptions: {
            ...fullDynamicSdkLoaderOptions,
            hasLogsAndMetrics: true,
          },
          browserSdkVersion: '10.x',
        }}
      />
    );

    const logsCheckbox = screen.getByRole('checkbox', {
      name: 'Enable Logs and Metrics',
    });
    expect(logsCheckbox).toBeEnabled();
    expect(logsCheckbox).toBeChecked();
  });

  it('renders the loader script tag', () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const data: ProjectKey = {
      ...ProjectKeysFixture()[0],
      dynamicSdkLoaderOptions,
    };

    render(
      <LoaderSettings
        updateData={jest.fn()}
        orgSlug={organization.slug}
        keyId={params.keyId}
        project={project}
        data={data}
      />
    );

    expect(screen.getByLabelText('Loader Script')).toHaveDisplayValue(
      `<script src="${data.dsn.cdn}" crossorigin="anonymous"></script>`
    );
  });

  it('shows performance message when it is enabled', () => {
    const {organization, project} = initializeOrg();
    const params = {
      projectSlug: project.slug,
      keyId: '1',
    };

    const data: ProjectKey = {
      ...ProjectKeysFixture()[0],
      dynamicSdkLoaderOptions: fullDynamicSdkLoaderOptions,
    };

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
      screen.getByText('tracesSampleRate: 1.0', {
        exact: false,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText('distributed tracing to same-origin requests', {
        exact: false,
      })
    ).toBeInTheDocument();

    data.dynamicSdkLoaderOptions.hasPerformance = false;

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
      screen.queryByText('tracesSampleRate: 1.0', {
        exact: false,
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText('distributed tracing to same-origin requests', {
        exact: false,
      })
    ).not.toBeInTheDocument();
  });
});
