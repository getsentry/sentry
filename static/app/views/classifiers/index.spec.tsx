import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ClassifiersLayout from 'sentry/views/classifiers';

describe('ClassifiersLayout', () => {
  it('renders the child route when classifiers-ui is enabled', () => {
    render(<ClassifiersLayout />, {
      organization: OrganizationFixture({features: ['classifiers-ui']}),
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/seer/classifiers/'},
        route: '/organizations/:orgId/seer/classifiers/',
        children: [{index: true, element: <div>Classifiers child</div>}],
      },
    });

    expect(screen.getByText('Classifiers child')).toBeInTheDocument();
  });

  it('renders not found without classifiers-ui', () => {
    render(<ClassifiersLayout />, {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/seer/classifiers/'},
        route: '/organizations/:orgId/seer/classifiers/',
        children: [{index: true, element: <div>Classifiers child</div>}],
      },
    });

    expect(screen.queryByText('Classifiers child')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Page Not Found'})).toBeInTheDocument();
  });
});
