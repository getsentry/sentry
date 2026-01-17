import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectQuickLinks from 'sentry/views/projectDetail/projectQuickLinks';

describe('ProjectDetail > ProjectQuickLinks', () => {
  const organization = OrganizationFixture({features: ['performance-view']});

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a list', async () => {
    const {router} = render(
      <ProjectQuickLinks organization={organization} project={ProjectFixture()} />
    );

    expect(screen.getByRole('heading', {name: 'Quick Links'})).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);

    const userFeedback = screen.getByRole('link', {name: 'User Feedback'});
    const keyTransactions = screen.getByRole('link', {name: 'View Transactions'});

    await userEvent.click(userFeedback);
    expect(router.location.pathname).toBe('/organizations/org-slug/feedback/');
    expect(router.location.query).toEqual({project: '2'});

    await userEvent.click(keyTransactions);
    expect(router.location.pathname).toBe('/organizations/org-slug/insights/backend/');
    expect(router.location.query).toEqual({project: '2'});
  });

  it('disables link if feature is missing', async () => {
    render(
      <ProjectQuickLinks
        organization={{...organization, features: []}}
        project={ProjectFixture()}
      />
    );

    const keyTransactions = screen.getByText('View Transactions');

    await userEvent.click(keyTransactions);

    await userEvent.hover(keyTransactions);
    expect(
      await screen.findByText("You don't have access to this feature")
    ).toBeInTheDocument();
  });
});
