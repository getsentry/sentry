import {useEffect} from 'react';
import {PreprodDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {z} from 'zod';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';

import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {
  DetectorFormProvider,
  useDetectorFormContext,
} from 'sentry/views/detectors/components/forms/context';
import {useSubmitCreateDetector} from 'sentry/views/detectors/hooks/useSubmitCreateDetector';

import {DetectorFormLayout} from './detectorFormLayout';
import {DetectorProjectEnvironmentSection} from './detectorProjectEnvironmentSection';
import {getDetectorSubmitTitle} from './getDetectorSubmitTitle';
import {useInitialDetectorCommonValues} from './useInitialDetectorCommonValues';

const schema = z.object({
  name: z.string(),
  projectId: z.string().min(1),
  environment: z.string().min(1, 'Choose an environment'),
  owner: z.string(),
  description: z.string().nullable(),
  workflowIds: z.array(z.string()),
});

function TestForm() {
  const defaultValues = useInitialDetectorCommonValues();
  const {hasSetDetectorName} = useDetectorFormContext();
  const submit = useSubmitCreateDetector({
    onError(error: unknown): void {
      if (error instanceof RequestError) {
        setFieldErrors(form, requestErrorToFieldErrors(error, form.state.values));
      }
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onChange: schema, onDynamic: schema},
    onSubmit: ({value}) => submit({...value, type: 'preprod_size_analysis'}),
  });
  useEffect(() => {
    if (!hasSetDetectorName) {
      form.setFieldValue('name', 'Automatic name', {
        dontUpdateMeta: true,
        dontValidate: true,
      });
    }
  }, [form, hasSetDetectorName]);
  return (
    <EditLayout>
      <form.AppForm form={form}>
        <DetectorFormLayout
          form={form}
          fields={{name: 'name'}}
          detectorType="preprod_size_analysis"
          submitButton={
            <form.Subscribe
              selector={state => ({
                isIncomplete: !state.values.projectId || !state.values.environment,
                isValid: state.isValid,
              })}
            >
              {state => (
                <form.SubmitButton
                  disabled={state.isIncomplete || !state.isValid}
                  tooltipProps={{title: getDetectorSubmitTitle(state)}}
                >
                  Create Monitor
                </form.SubmitButton>
              )}
            </form.Subscribe>
          }
        >
          <DetectorProjectEnvironmentSection
            form={form}
            fields={{projectId: 'projectId', environment: 'environment'}}
            detectorType="preprod_size_analysis"
            requiredEnvironment
            includeAllEnvironments={false}
          />
        </DetectorFormLayout>
      </form.AppForm>
    </EditLayout>
  );
}

describe('Scraps detector foundation', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '1', environments: ['production'], isMember: true});
  const secondProject = ProjectFixture({
    id: '2',
    slug: 'second-project',
    environments: ['staging'],
    isMember: false,
  });
  const renderForm = () =>
    render(
      <DetectorFormProvider detectorType="preprod_size_analysis">
        <TestForm />
      </DetectorFormProvider>,
      {organization}
    );

  beforeEach(() => {
    OrganizationStore.init();
    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData([secondProject, project]);
    MockApiClient.clearMockResponses();
  });

  it('starts incomplete without visible validation and becomes valid after selecting an environment', async () => {
    renderForm();
    expect(screen.getByRole('button', {name: 'Create Monitor'})).toBeDisabled();
    expect(screen.queryByText('Choose an environment')).not.toBeInTheDocument();
    expect(screen.getByText(project.slug)).toBeInTheDocument();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Environment'}),
      'production'
    );
    expect(screen.getByRole('button', {name: 'Create Monitor'})).toBeEnabled();
  });

  it('retains a manual name and supports a newly created environment', async () => {
    renderForm();
    await userEvent.click(screen.getByText('Automatic name'));
    const name = screen.getByRole('textbox', {name: 'Monitor Name'});
    await userEvent.clear(name);
    await userEvent.type(name, 'Manual name{Enter}');
    const environment = screen.getByRole('textbox', {name: 'Select Environment'});
    await userEvent.type(environment, 'preview');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('Manual name')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create Monitor'})).toBeEnabled();
  });

  it('recovers project permission validation when switching back to an allowed project', async () => {
    const limitedOrganization = OrganizationFixture({access: []});
    OrganizationStore.onUpdate(limitedOrganization, {replace: true});
    ProjectsStore.loadInitialData([
      {...project, access: ['alerts:write']},
      {...secondProject, access: []},
    ]);
    render(
      <DetectorFormProvider detectorType="preprod_size_analysis">
        <TestForm />
      </DetectorFormProvider>,
      {organization: limitedOrganization}
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Environment'}),
      'production'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Project'}),
      secondProject.slug
    );
    expect(screen.getByRole('button', {name: 'Create Monitor'})).toBeDisabled();
    expect(
      screen.getByText(
        'You do not have permission to create or edit monitors in this project'
      )
    ).toBeInTheDocument();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Project'}),
      project.slug
    );
    expect(screen.getByRole('button', {name: 'Create Monitor'})).toBeEnabled();
    expect(
      screen.queryByText(
        'You do not have permission to create or edit monitors in this project'
      )
    ).not.toBeInTheDocument();
  });

  it('maps server field errors, retains input, and permits a corrected retry', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
      method: 'POST',
      statusCode: 400,
      body: {environment: ['Environment rejected']},
    });
    renderForm();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Environment'}),
      'production'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));
    expect(await screen.findByText('Environment rejected')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create Monitor'})).toBeDisabled();
    const success = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
      method: 'POST',
      body: PreprodDetectorFixture(),
    });
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Select Environment'}),
      'preview'
    );
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));
    await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  });

  it('prevents duplicate submission while saving and navigates on success', async () => {
    const response = Promise.withResolvers<void>();
    const detector = PreprodDetectorFixture();
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
      method: 'POST',
      body: detector,
      asyncDelay: response.promise,
    });
    const {router} = renderForm();
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Environment'}),
      'production'
    );
    const submit = screen.getByRole('button', {name: 'Create Monitor'});
    await userEvent.click(submit);
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(request).toHaveBeenCalledTimes(1);
    await act(() => response.resolve());
    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/monitors/${detector.id}/`
      )
    );
  });
});
