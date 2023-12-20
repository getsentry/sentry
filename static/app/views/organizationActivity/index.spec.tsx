import {ActivityFeed} from 'sentry-fixture/activityFeed';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types';
import OrganizationActivity from 'sentry/views/organizationActivity';

describe('OrganizationActivity', function () {
  const {router, organization, routerContext} = initializeOrg();
  let params = {};

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [
        ActivityFeed(),
        ActivityFeed({
          id: '49',
          data: {},
          type: GroupActivityType.SET_PUBLIC,
        }),
      ],
    });
    params = {
      ...router,
      params: {
        orgId: organization.slug,
      },
    };
  });

  it('renders', function () {
    render(<OrganizationActivity {...params} />, {context: routerContext});

    expect(screen.getAllByTestId('activity-feed-item')).toHaveLength(2);
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [],
    });
    render(<OrganizationActivity {...params} />, {context: routerContext});

    expect(screen.queryByTestId('activity-feed-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders not found', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [],
      statusCode: 404,
    });
    render(<OrganizationActivity {...params} />, {context: routerContext});

    expect(screen.queryByTestId('activity-feed-item')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });
});
