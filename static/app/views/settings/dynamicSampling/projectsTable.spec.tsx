import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {mockElementSize} from 'sentry/utils/fixtures/virtualization';
import type {ProjectionSamplePeriod} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

import {ProjectsTable} from './projectsTable';

mockElementSize({height: 400});

describe('ProjectsTable', () => {
  const organization = OrganizationFixture({
    access: ['org:write'],
  });

  const project = ProjectFixture();

  const defaultProps = {
    items: [
      {
        project,
        count: 1000,
        ownCount: 800,
        sampleRate: '10',
        initialSampleRate: '10',
        subProjects: [],
      },
    ],
    period: '24h' as ProjectionSamplePeriod,
    rateHeader: 'Sample Rate',
    isLoading: false,
    emptyMessage: 'No projects found',
  };

  it('disables input when user does not have access', () => {
    const orgWithoutAccess = OrganizationFixture({
      access: [], // No org:write access
    });

    render(<ProjectsTable {...defaultProps} canEdit />, {
      organization: orgWithoutAccess,
    });

    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });

  it('enables input when user has access and canEdit is true', () => {
    render(<ProjectsTable {...defaultProps} canEdit />, {
      organization,
    });

    expect(screen.getByRole('spinbutton')).toBeEnabled();
  });

  it('disables input when canEdit is false, regardless of access', () => {
    render(<ProjectsTable {...defaultProps} canEdit={false} />, {
      organization,
    });

    expect(screen.getByRole('spinbutton')).toBeDisabled();
  });

  it('does not show settings button when user does not have project:write access', () => {
    render(<ProjectsTable {...defaultProps} />, {
      organization,
    });

    expect(
      screen.queryByRole('button', {name: 'Open Project Settings'})
    ).not.toBeInTheDocument();
  });

  it('shows settings button only when user has project:write access', () => {
    const orgWithProjectAccess = OrganizationFixture({
      access: ['org:write', 'project:write'],
    });

    render(<ProjectsTable {...defaultProps} />, {
      organization: orgWithProjectAccess,
    });

    expect(
      screen.getByRole('button', {name: 'Open Project Settings'})
    ).toBeInTheDocument();
  });

  it('reverses the row order when the accepted spans header is clicked', async () => {
    const items = [
      {...defaultProps.items[0]!, project: ProjectFixture({id: '1', slug: 'small'})},
      {
        ...defaultProps.items[0]!,
        count: 5000,
        project: ProjectFixture({id: '2', slug: 'large'}),
      },
    ];

    render(<ProjectsTable {...defaultProps} items={items} />, {organization});

    const getRowSlugs = () => {
      const [, body] = within(screen.getByRole('table', {name: 'Projects'})).getAllByRole(
        'rowgroup'
      );
      return within(body!)
        .getAllByRole('row')
        .map(row => row.textContent);
    };

    const initialSlugs = getRowSlugs();
    await userEvent.click(screen.getByRole('button', {name: 'Accepted Spans'}));
    const sortedSlugs = getRowSlugs();

    expect(initialSlugs[0]).toContain('large');
    expect(sortedSlugs[0]).toContain('small');
  });

  it('lists sub-projects when an expandable row is expanded', async () => {
    const items = [
      {
        ...defaultProps.items[0]!,
        subProjects: [
          {project: ProjectFixture({id: '3', slug: 'downstream'}), count: 200},
        ],
      },
    ];

    render(<ProjectsTable {...defaultProps} items={items} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));

    expect(screen.getByRole('button', {name: 'Collapse'})).toBeInTheDocument();
    expect(screen.getByText('downstream')).toBeInTheDocument();
  });

  it('shows the empty message when there are no items', () => {
    render(<ProjectsTable {...defaultProps} items={[]} />, {organization});

    expect(screen.getByRole('table', {name: 'Projects'})).toHaveTextContent(
      'No projects found'
    );
  });

  it('shows a loading indicator when loading', () => {
    render(<ProjectsTable {...defaultProps} isLoading />, {organization});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
