import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType} from 'sentry/types/group';
import OrganizationActivity from 'sentry/views/organizationActivity';

describe('OrganizationActivity', function () {
  const {router, organization} = initializeOrg();
  let params = {};

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [
        ActivityFeedFixture(),
        ActivityFeedFixture({
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

  it('renders', async function () {
    render(<OrganizationActivity {...params} />, {router});

    expect(await screen.findAllByTestId('activity-feed-item')).toHaveLength(2);
  });

  it('renders empty', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [],
    });
    render(<OrganizationActivity {...params} />, {router});

    expect(screen.queryByTestId('activity-feed-item')).not.toBeInTheDocument();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders not found', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/activity/',
      body: [],
      statusCode: 404,
    });
    render(<OrganizationActivity {...params} />, {router});

    expect(screen.queryByTestId('activity-feed-item')).not.toBeInTheDocument();
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });
});
