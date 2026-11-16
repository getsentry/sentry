import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectQuickLinks} from './projectQuickLinks';

describe('ProjectDetail > ProjectQuickLinks', () => {
  const organization = OrganizationFixture();

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
    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/feedback/');
      expect(router.location.query).toEqual({project: '2'});
    });

    await userEvent.click(keyTransactions);
    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/insights/backend/');
      expect(router.location.query).toEqual({project: '2'});
    });
  });
});
