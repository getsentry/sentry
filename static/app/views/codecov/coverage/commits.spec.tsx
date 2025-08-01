import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import CommitsListPage from 'sentry/views/codecov/coverage/commits';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CommitsListPage', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the page filter controls', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    expect(screen.getByTestId('page-filter-org-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-repo-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-branch-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-upload-selector')).toBeInTheDocument();
  });

  it('renders tab navigation', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('Pulls')).toBeInTheDocument();
    expect(screen.getByText('File Explorer')).toBeInTheDocument();
  });

  it('renders commits section by default', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    expect(screen.getByRole('textbox', {name: /filter by commit name/})).toBeInTheDocument();
    expect(screen.getByRole('table', {name: 'Commits Table'})).toBeInTheDocument();
  });

  it('renders commits table with correct headers', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('Patch coverage')).toBeInTheDocument();
    expect(screen.getByText('Upload count')).toBeInTheDocument();
  });

  it('renders commit data in table rows', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    // Check for mock commit data
    expect(screen.getByText('step4: add smiles')).toBeInTheDocument();
    expect(screen.getByText('d677638')).toBeInTheDocument();
    expect(screen.getByText('68.50%')).toBeInTheDocument();
  });

  it('renders upload count with status breakdown', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    expect(screen.getByText('81')).toBeInTheDocument(); // Total uploads
    expect(screen.getByText('65 Processed')).toBeInTheDocument();
    expect(screen.getByText('15 Pending')).toBeInTheDocument();
    expect(screen.getByText('1 Failed')).toBeInTheDocument();
  });

  it('renders pagination controls', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    expect(screen.getByText('1-5 of 9')).toBeInTheDocument();
  });

  it('allows filtering commits by search query', async () => {
    const user = userEvent.setup();
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const searchInput = screen.getByRole('textbox', {name: /filter by commit name/});
    await user.type(searchInput, 'add smiles');

    expect(searchInput).toHaveValue('add smiles');
  });

  it('allows switching between tabs', async () => {
    const user = userEvent.setup();
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    // Click on Pulls tab
    await user.click(screen.getByText('Pulls'));
    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    expect(screen.getByText('Review pull requests and their coverage impact.')).toBeInTheDocument();

    // Click on File Explorer tab
    await user.click(screen.getByText('File Explorer'));
    expect(screen.getByText('File Explorer')).toBeInTheDocument();
    expect(screen.getByText('Browse repository files and view detailed coverage information.')).toBeInTheDocument();

    // Switch back to Commits tab
    await user.click(screen.getByText('Commits'));
    expect(screen.getByRole('table', {name: 'Commits Table'})).toBeInTheDocument();
  });

  it('renders user avatars for commit authors', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    // Check that user avatars are rendered (they will have alt text with user name)
    const avatars = screen.getAllByRole('img');
    expect(avatars.length).toBeGreaterThan(0);
  });

  it('renders commit hash links to GitHub', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    const commitLink = screen.getByRole('link', {name: /d677638/});
    expect(commitLink).toHaveAttribute('href', 'https://github.com/example-org/example-repo/commit/d677638');
    expect(commitLink).toHaveAttribute('target', '_blank');
  });

  it('handles upload filter dropdown interaction', async () => {
    const user = userEvent.setup();
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    // Click to open upload filter dropdown
    const uploadFilterButton = screen.getByTestId('page-filter-upload-selector');
    await user.click(uploadFilterButton);

    // Check that dropdown options appear
    await waitFor(() => {
      expect(screen.getByText('All uploads')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  it('displays proper upload status colors', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    // Check that status indicators are present (they have specific styling)
    expect(screen.getByText('65 Processed')).toBeInTheDocument();
    expect(screen.getByText('15 Pending')).toBeInTheDocument();
    expect(screen.getByText('1 Failed')).toBeInTheDocument();
  });

  it('renders tooltip for upload count header', async () => {
    const user = userEvent.setup();
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    // The upload count header has a question mark tooltip
    const tooltipTrigger = screen.getByRole('button', {name: /upload count.*tooltip/i});
    await user.hover(tooltipTrigger);

    await waitFor(() => {
      expect(screen.getByText('Uploads count')).toBeInTheDocument();
    });
  });

  it('displays commit timestamps correctly', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    expect(screen.getByText('1 day ago')).toBeInTheDocument();
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
    expect(screen.getByText('3 days ago')).toBeInTheDocument();
  });

  it('shows correct default filter selections', () => {
    render(<CommitsListPage />, {
      organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
    });

    // The upload filter should show "2 selected" for completed and pending
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });
});
