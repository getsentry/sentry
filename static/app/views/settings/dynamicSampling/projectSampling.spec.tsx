import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import {ProjectSampling} from './projectSampling';

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

describe('ProjectSampling', () => {
  const project = ProjectFixture({id: '1', slug: 'project-slug'});
  const organization = OrganizationFixture({
    slug: 'org-slug',
    access: ['org:write'],
    samplingMode: 'project',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sampling/project-root-counts/',
      body: {
        data: [
          [
            {
              by: {project: 'project-slug', target_project_id: '1'},
              totals: 1000,
              series: [],
            },
          ],
        ],
        end: '',
        intervals: [],
        start: '',
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sampling/project-rates/',
      body: [{id: 1, sampleRate: 0.5}],
    });
  });

  async function waitForProjectRateInput() {
    return screen.findByRole('spinbutton', {
      name: 'Sample rate for project-slug',
    });
  }

  it('renders project rate inputs with initial values', async () => {
    // The input briefly transitions from uncontrolled to controlled as form
    // state initializes with the fetched project rates.
    jest.spyOn(console, 'error').mockImplementation();

    render(<ProjectSampling />, {organization});

    const input = await waitForProjectRateInput();
    expect(input).toHaveValue(50);
  });

  it('enables Reset button after changing a project rate', async () => {
    render(<ProjectSampling />, {organization});

    const input = await waitForProjectRateInput();
    expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, '30');

    expect(screen.getByRole('button', {name: 'Reset'})).toBeEnabled();
  });

  it('resets the input back to the saved value when Reset is clicked', async () => {
    render(<ProjectSampling />, {organization});

    const input = await waitForProjectRateInput();
    await userEvent.clear(input);
    await userEvent.type(input, '30');

    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    expect(input).toHaveValue(50);
  });

  it('shows validation error for empty value on submit', async () => {
    render(<ProjectSampling />, {organization});

    const input = await waitForProjectRateInput();
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    expect(await screen.findByText('Please enter a valid number')).toBeInTheDocument();
  });

  it('calls the API with the correct payload on save', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sampling/project-rates/',
      method: 'PUT',
      body: [{id: 1, sampleRate: 0.3}],
    });

    render(<ProjectSampling />, {organization});

    const input = await waitForProjectRateInput();
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/organizations/org-slug/sampling/project-rates/',
        expect.objectContaining({data: [{id: 1, sampleRate: 0.3}]})
      );
    });
  });

  it('resets form to clean state after a successful save', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sampling/project-rates/',
      method: 'PUT',
      body: [{id: 1, sampleRate: 0.3}],
    });

    render(<ProjectSampling />, {organization});

    const input = await waitForProjectRateInput();
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Reset'})).toBeDisabled()
    );
  });

  it('keeps form dirty after an API error', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sampling/project-rates/',
      method: 'PUT',
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });

    render(<ProjectSampling />, {organization});

    const input = await waitForProjectRateInput();
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Reset'})).toBeEnabled()
    );
  });

  it('updates project rates atomically via bulk org rate edit', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sampling/project-rates/',
      method: 'PUT',
      body: [{id: 1, sampleRate: 0.8}],
    });

    render(<ProjectSampling />, {organization});

    await waitForProjectRateInput();

    // Activate bulk edit mode
    await userEvent.click(
      screen.getByRole('button', {name: 'Proportionally scale project rates'})
    );

    // Type a new org rate — this should update all project rates in one atomic call
    const orgRateInput = screen.getAllByRole('spinbutton')[0]!;
    await userEvent.clear(orgRateInput);
    await userEvent.type(orgRateInput, '80');

    // The project rate should have been scaled
    const projectInput = screen.getByRole('spinbutton', {
      name: 'Sample rate for project-slug',
    });
    expect(projectInput).toHaveValue(80);

    // Submit and verify the API call
    await userEvent.click(screen.getByRole('button', {name: 'Apply Changes'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        '/organizations/org-slug/sampling/project-rates/',
        expect.objectContaining({data: [{id: 1, sampleRate: 0.8}]})
      );
    });
  });

  it('disables Apply Changes for users without org:write access', async () => {
    const orgWithoutAccess = OrganizationFixture({
      access: [],
      samplingMode: 'project',
    });

    render(<ProjectSampling />, {organization: orgWithoutAccess});

    await waitForProjectRateInput();
    expect(screen.getByRole('button', {name: 'Apply Changes'})).toBeDisabled();
  });
});
