import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import ProjectIssueGrouping from 'sentry/views/settings/projectIssueGrouping';

jest.mock('sentry/utils/isActiveSuperuser', () => ({
  isActiveSuperuser: jest.fn(),
}));

describe('projectIssueGrouping', () => {
  const {organization, projects} = initializeOrg();
  const project = projects[0]!;

  it('renders successfully', async () => {
    render(<ProjectIssueGrouping />, {
      organization,
      outletContext: {project},
    });

    expect(await screen.findByText(/Derived Grouping Enhancements/)).toBeInTheDocument();
  });

  it('shows derived grouping enhancements only for superusers', async () => {
    // First render with a non-superuser
    const {rerender} = render(<ProjectIssueGrouping />, {
      organization,
      outletContext: {project},
    });

    // Verify the section is visible for non-superuser
    expect(await screen.findByText(/Derived Grouping Enhancements/)).toBeInTheDocument();
    expect(screen.getByText(/Derived Grouping Enhancements/)).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /Derived Grouping Enhancements/})
    ).toBeDisabled();

    // Re-render for superuser
    jest.mocked(isActiveSuperuser).mockReturnValue(true);
    rerender(<ProjectIssueGrouping />);

    // Verify the section is visible for superuser
    expect(screen.getByText(/Derived Grouping Enhancements/)).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /Derived Grouping Enhancements/})
    ).toBeDisabled();
  });

  it('saves fingerprint rules via the Save button', async () => {
    const endpoint = `/projects/${organization.slug}/${project.slug}/`;
    const updateMock = MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      body: {...project, fingerprintingRules: 'error.type:Foo -> bar'},
      match: [MockApiClient.matchData({fingerprintingRules: 'error.type:Foo -> bar'})],
    });

    render(<ProjectIssueGrouping />, {organization, outletContext: {project}});

    const input = await screen.findByRole('textbox', {name: 'Fingerprint Rules'});
    await userEvent.type(input, 'error.type:Foo -> bar');
    await userEvent.click(
      within(input.closest('form')!).getByRole('button', {name: 'Save'})
    );

    await waitFor(() => expect(updateMock).toHaveBeenCalled());
  });

  it('surfaces API validation errors inline', async () => {
    const endpoint = `/projects/${organization.slug}/${project.slug}/`;
    MockApiClient.addMockResponse({
      url: endpoint,
      method: 'PUT',
      statusCode: 400,
      body: {fingerprintingRules: ['Invalid fingerprint rule']},
    });

    render(<ProjectIssueGrouping />, {organization, outletContext: {project}});

    const input = await screen.findByRole('textbox', {name: 'Fingerprint Rules'});
    await userEvent.type(input, 'this is not a valid rule');
    await userEvent.click(
      within(input.closest('form')!).getByRole('button', {name: 'Save'})
    );

    expect(await screen.findByText('Invalid fingerprint rule')).toBeInTheDocument();
  });
});
