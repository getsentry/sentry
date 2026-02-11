import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import ProjectIssueGrouping from 'sentry/views/settings/projectIssueGrouping';

jest.mock('sentry/utils/isActiveSuperuser', () => ({
  isActiveSuperuser: jest.fn(),
}));

describe('projectIssueGrouping', () => {
  const {organization, projects} = initializeOrg();
  const project = projects[0]!;

  it('renders successfully', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/grouping-configs/`,
      body: [],
    });

    render(<ProjectIssueGrouping />, {
      organization,
      outletContext: {project},
    });

    expect(request).toHaveBeenCalled();
    expect(await screen.findByText('Issue Grouping')).toBeInTheDocument();
  });

  it('renders error', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/grouping-configs/`,
      body: {
        detail: 'Internal Error',
      },
      statusCode: 500,
    });

    render(<ProjectIssueGrouping />, {
      organization,
      outletContext: {project},
    });

    expect(request).toHaveBeenCalled();
    expect(
      await screen.findByText('Failed to load grouping configs')
    ).toBeInTheDocument();
  });

  it('shows derived grouping enhancements only for superusers', async () => {
    // Mock the API response
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/grouping-configs/`,
      body: [],
    });

    // First render with a non-superuser
    const {rerender} = render(<ProjectIssueGrouping />, {
      organization,
      outletContext: {project},
    });

    // Verify the section is not visible for non-superuser
    expect(await screen.findByText('Issue Grouping')).toBeInTheDocument();
    expect(screen.queryByText(/Derived Grouping Enhancements/)).not.toBeInTheDocument();

    // Re-render for superuser
    jest.mocked(isActiveSuperuser).mockReturnValue(true);
    rerender(<ProjectIssueGrouping />);

    // Verify the section is visible for superuser
    expect(screen.getByText(/Derived Grouping Enhancements/)).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: /Derived Grouping Enhancements/})
    ).toBeDisabled();
  });
});
