import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationSampling} from 'sentry/views/settings/dynamicSampling/organizationSampling';
import type {ProjectsPreviewTableProps} from 'sentry/views/settings/dynamicSampling/projectsPreviewTable';

// Render only the form-relevant parts: the input and the action buttons.
// This avoids pulling in the virtualized ProjectsTable.
jest.mock('sentry/views/settings/dynamicSampling/projectsPreviewTable', () => ({
  ProjectsPreviewTable: ({
    actions,
    targetSampleRate,
    savedTargetSampleRate,
    onTargetSampleRateChange,
    targetSampleRateError,
  }: ProjectsPreviewTableProps) => (
    <div>
      <label htmlFor="target-sample-rate">Target Sample Rate</label>
      <input
        id="target-sample-rate"
        type="number"
        value={targetSampleRate}
        onChange={e => onTargetSampleRateChange(e.target.value)}
      />
      {targetSampleRateError && <span role="alert">{targetSampleRateError}</span>}
      {savedTargetSampleRate !== targetSampleRate && (
        <span>previous: {savedTargetSampleRate}%</span>
      )}
      {actions}
    </div>
  ),
}));

jest.mock('sentry/views/settings/dynamicSampling/samplingModeSwitch', () => ({
  SamplingModeSwitch: () => null,
}));

jest.mock('sentry/views/settings/dynamicSampling/projectionPeriodControl', () => ({
  ProjectionPeriodControl: () => null,
}));

describe('OrganizationSampling', () => {
  const organization = OrganizationFixture({
    slug: 'org-slug',
    access: ['org:write'],
    targetSampleRate: 0.5,
    samplingMode: 'organization',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('pre-fills the input with the organization target sample rate', () => {
    render(<OrganizationSampling />, {organization});

    expect(screen.getByRole('spinbutton', {name: 'Target Sample Rate'})).toHaveValue(50);
  });

  it('Save and Reset buttons are disabled when the form is clean', () => {
    render(<OrganizationSampling />, {organization});

    expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled();
  });

  it('enables Save and Reset buttons after changing the rate', async () => {
    render(<OrganizationSampling />, {organization});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);
    await userEvent.type(input, '30');

    expect(screen.getByRole('button', {name: 'Save changes'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Reset'})).toBeEnabled();
  });

  it('disables Save and shows a validation error for an out-of-range value', async () => {
    render(<OrganizationSampling />, {organization});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);
    await userEvent.type(input, '150');

    expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Must be between 0% and 100%');
  });

  it('disables Save and shows a validation error for an empty value', async () => {
    render(<OrganizationSampling />, {organization});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);

    expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required.');
  });

  it('calls the API with the correct payload on save', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      body: OrganizationFixture({targetSampleRate: 0.3}),
    });

    render(<OrganizationSampling />, {organization});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/organizations/org-slug/',
        expect.objectContaining({
          data: {targetSampleRate: 0.3},
        })
      );
    });
  });

  it('resets form to clean state after a successful save', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      body: OrganizationFixture({targetSampleRate: 0.3}),
    });

    render(<OrganizationSampling />, {organization});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
    });
    expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled();
  });

  it('updates the previous value display after a successful save', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      body: OrganizationFixture({targetSampleRate: 0.3}),
    });

    render(<OrganizationSampling />, {organization});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    // After save, change the value again to reveal the "previous" display
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
    });

    await userEvent.clear(input);
    await userEvent.type(input, '20');

    // Previous value should now be the just-saved 30, not the original 50
    expect(screen.getByText('previous: 30%')).toBeInTheDocument();
  });

  it('keeps form dirty and does not call API again after an error', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });

    render(<OrganizationSampling />, {organization});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', {name: 'Save changes'}));

    await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', {name: 'Save changes'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Reset'})).toBeEnabled();
  });

  it('resets the input back to the saved value when Reset is clicked', async () => {
    render(<OrganizationSampling />, {organization});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);
    await userEvent.type(input, '30');

    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    expect(input).toHaveValue(50);
  });

  it('disables the Save button for users without org:write access', async () => {
    const orgWithoutAccess = OrganizationFixture({
      access: [],
      targetSampleRate: 0.5,
      samplingMode: 'organization',
    });

    render(<OrganizationSampling />, {organization: orgWithoutAccess});

    const input = screen.getByRole('spinbutton', {name: 'Target Sample Rate'});
    await userEvent.clear(input);
    await userEvent.type(input, '30');

    expect(screen.getByRole('button', {name: 'Save changes'})).toBeDisabled();
    // Reset is unrelated to permissions so it stays enabled
    expect(screen.getByRole('button', {name: 'Reset'})).toBeEnabled();
  });
});
