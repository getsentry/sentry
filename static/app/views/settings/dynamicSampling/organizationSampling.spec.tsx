import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationSampling} from 'sentry/views/settings/dynamicSampling/organizationSampling';

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count}: {count: number}) => ({
    getVirtualItems: jest.fn(() =>
      Array.from({length: count}, (_, index) => ({
        key: index,
        index,
        start: index * 63,
        size: 63,
      }))
    ),
    getTotalSize: jest.fn(() => count * 63),
    measure: jest.fn(),
  })),
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sampling/project-root-counts/',
      body: {data: [], end: '', intervals: [], start: ''},
    });
  });

  it('pre-fills the input with the organization target sample rate', () => {
    render(<OrganizationSampling />, {organization});

    expect(screen.getByRole('spinbutton')).toHaveValue(50);
  });

  it('Reset button is disabled when the form is clean', () => {
    render(<OrganizationSampling />, {organization});

    expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled();
  });

  it('Apply Changes button is always enabled when user has access', () => {
    render(<OrganizationSampling />, {organization});

    expect(screen.getByRole('button', {name: 'Apply Changes'})).toBeEnabled();
  });

  it('enables Reset button after changing the rate', async () => {
    render(<OrganizationSampling />, {organization});

    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '30');

    expect(screen.getByRole('button', {name: 'Reset'})).toBeEnabled();
  });

  it('does not call the API when value is out of range', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      body: OrganizationFixture(),
    });

    render(<OrganizationSampling />, {organization});

    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '150');
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    // Zod validation prevents the API call
    expect(putMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for an empty value on submit', async () => {
    render(<OrganizationSampling />, {organization});

    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    expect(await screen.findByText('Please enter a valid number')).toBeInTheDocument();
  });

  it('calls the API with the correct payload on save', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      body: OrganizationFixture({targetSampleRate: 0.3}),
    });

    render(<OrganizationSampling />, {organization});

    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '30');
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/organizations/org-slug/',
        expect.objectContaining({data: {targetSampleRate: 0.3}})
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

    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '30');
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled()
    );
  });

  it('keeps form dirty after an API error', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });

    render(<OrganizationSampling />, {organization});

    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '30');
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Reset'})).toBeEnabled()
    );
  });

  it('resets the input back to the saved value when Reset is clicked', async () => {
    render(<OrganizationSampling />, {organization});

    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '30');
    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    expect(screen.getByRole('spinbutton')).toHaveValue(50);
  });

  it('disables the Apply Changes button for users without org:write access', () => {
    const orgWithoutAccess = OrganizationFixture({
      access: [],
      targetSampleRate: 0.5,
      samplingMode: 'organization',
    });

    render(<OrganizationSampling />, {organization: orgWithoutAccess});

    expect(screen.getByRole('button', {name: 'Apply Changes'})).toBeDisabled();
  });
});
