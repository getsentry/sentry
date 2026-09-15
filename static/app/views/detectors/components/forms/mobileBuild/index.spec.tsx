import {PreprodDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';

import {EditExistingPreprodDetectorForm, NewPreprodDetectorForm} from './index';

describe('mobile build detector form', () => {
  const organization = OrganizationFixture({
    features: ['preprod-size-monitors-frontend'],
  });
  const project = ProjectFixture({organization});
  const detector = PreprodDetectorFixture({projectId: project.id});

  beforeEach(() => {
    OrganizationStore.init();
    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData([project]);
    MockApiClient.clearMockResponses();
    for (const path of [
      'members',
      'teams',
      'workflows',
      'recent-searches',
      'trace-items/attributes',
    ]) {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/${path}/`,
        body: [],
      });
    }
  });

  it('creates a monitor with a zero threshold', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
      method: 'POST',
      body: detector,
    });
    render(
      <DetectorFormProvider detectorType="preprod_size_analysis">
        <NewPreprodDetectorForm />
      </DetectorFormProvider>,
      {organization}
    );
    const inputs = await screen.findAllByRole('spinbutton');
    await userEvent.type(inputs[0]!, '0');
    await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'New Monitor',
            type: 'preprod_size_analysis',
            projectId: project.id,
            owner: null,
            description: null,
            workflowIds: [],
            conditionGroup: {
              logicType: 'any',
              conditions: [{type: 'gt', comparison: 0, conditionResult: 75}],
            },
            config: {
              measurement: 'install_size',
              thresholdType: 'absolute',
              query: undefined,
            },
          },
        })
      )
    );
  });

  it('saves an existing monitor without changing its configuration', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      method: 'PUT',
      body: detector,
    });
    render(
      <DetectorFormProvider detectorType="preprod_size_analysis" detector={detector}>
        <EditExistingPreprodDetectorForm detector={detector} />
      </DetectorFormProvider>,
      {organization}
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            detectorId: detector.id,
            name: detector.name,
            type: 'preprod_size_analysis',
            projectId: project.id,
            owner: null,
            description: null,
            workflowIds: [],
            conditionGroup: {
              logicType: 'any',
              conditions: [{type: 'gt', comparison: 8, conditionResult: 75}],
            },
            config: {
              measurement: 'install_size',
              thresholdType: 'absolute',
              query: undefined,
            },
          },
        })
      )
    );
  });

  it('requires a threshold and retains values while switching units', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
      method: 'POST',
      body: detector,
    });
    render(
      <DetectorFormProvider detectorType="preprod_size_analysis">
        <NewPreprodDetectorForm />
      </DetectorFormProvider>,
      {organization}
    );
    expect(await screen.findByRole('button', {name: 'Create Monitor'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));
    expect(request).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/At least one threshold is required/)
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Low threshold'}), '1.25');
    expect(screen.getByRole('button', {name: 'Create Monitor'})).toBeEnabled();
    await userEvent.click(screen.getByRole('radio', {name: /^Relative Diff/}));
    expect(screen.getByRole('spinbutton', {name: 'Low threshold'})).toHaveValue(1.25);
    await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            conditionGroup: {
              logicType: 'any',
              conditions: [{type: 'gt', comparison: 1.25, conditionResult: 25}],
            },
            config: {
              measurement: 'install_size',
              thresholdType: 'relative_diff',
              query: undefined,
            },
          }),
        })
      )
    );
  });

  it('keeps edits after a failed save and supports retry', async () => {
    const failedRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      method: 'PUT',
      statusCode: 500,
      body: {detail: 'Please retry'},
    });
    render(
      <DetectorFormProvider detectorType="preprod_size_analysis" detector={detector}>
        <EditExistingPreprodDetectorForm detector={detector} />
      </DetectorFormProvider>,
      {organization}
    );
    const input = await screen.findByRole('spinbutton', {name: 'High threshold'});
    await userEvent.clear(input);
    await userEvent.type(input, '5');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(failedRequest).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue(5);
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detector.id}/`,
      method: 'PUT',
      body: detector,
    });
    await waitFor(() => expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled());
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  });

  it('updates the preview and submits the current build filter', async () => {
    ProjectsStore.loadInitialData([{...project, platform: 'android'}]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [{key: 'git_head_ref', name: 'git_head_ref', attributeType: 'string'}],
    });
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
      method: 'POST',
      body: detector,
    });
    render(
      <DetectorFormProvider detectorType="preprod_size_analysis">
        <NewPreprodDetectorForm />
      </DetectorFormProvider>,
      {organization}
    );
    expect(
      await screen.findByText('Uncompressed Size threshold exceeded')
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole('spinbutton', {name: 'High threshold'}), '2');
    expect(screen.getByText('3 MB > 2 MB Threshold')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', {name: /^Relative Diff/}));
    expect(screen.getByText('2.05 % > 2 % Threshold')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', {name: 'Download Size'}));
    expect(screen.getByText('Download Size threshold exceeded')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('query-builder-input'));
    await userEvent.paste('git_head_ref:main');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            config: {
              measurement: 'download_size',
              thresholdType: 'relative_diff',
              query: 'git_head_ref:main',
            },
          }),
        })
      )
    );
  });
});
