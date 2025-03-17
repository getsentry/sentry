import {ProjectFixture} from 'getsentry-test/fixtures/project';
import {
  mockRootAllocations,
  mockSpendAllocations,
} from 'getsentry-test/fixtures/spendAllocation';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  cleanup,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {SpendAllocationsRoot} from 'getsentry/views/spendAllocations/index';

describe('SpendAllocations feature enable flow', () => {
  let organization: any, subscription: any, mockGet: any, dateTs: number;
  beforeEach(() => {
    organization = initializeOrg({
      organization: {
        features: ['spend-allocations'],
      },
    }).organization;
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      planTier: 'am1',
    });
    MockApiClient.clearMockResponses();
    dateTs = Math.max(
      new Date().getTime() / 1000,
      new Date(subscription.onDemandPeriodStart + 'T00:00:00.000').getTime() / 1000
    );
    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: [],
      status: 403,
      statusCode: 403,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });
  });
  afterEach(() => {
    cleanup();
  });

  it('renders enable button for owners/billing in an org that has not enabled spend allocations', async () => {
    organization.access = [
      'org:read',
      'org:write',
      'org:admin',
      'org:billing',
      'project:read',
      'project:admin',
    ];
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    await waitFor(() =>
      screen.findByRole('button', {
        name: 'Get started',
      })
    );

    const enableSpendAllocations = screen.getByRole('button', {
      name: 'Get started',
    });
    expect(enableSpendAllocations).toBeInTheDocument();
    expect(enableSpendAllocations).toBeEnabled();
  });

  it('does not render for YY partnership', async function () {
    subscription = SubscriptionFixture({
      plan: 'am2_business',
      planTier: 'am2',
      partner: {
        externalId: 'x123x',
        name: 'YY Org',
        partnership: {
          id: 'YY',
          displayName: 'YY',
          supportNote: 'foo',
        },
        isActive: true,
      },
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    expect(await screen.findByTestId('partnership-note')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Get Started'})).not.toBeInTheDocument();
  });

  it('does not render enable button for non billing role for org that has not enabled spend allocations', async () => {
    organization.access = ['project:read', 'project:admin'];
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    // Waiting a tick for requests to finish
    await act(tick);
    expect(screen.queryByRole('button', {name: 'Get Started'})).not.toBeInTheDocument();
  });

  it('re-fetches org and project spend-allocations on enable click', async () => {
    organization.access = [
      'org:read',
      'org:write',
      'org:admin',
      'org:billing',
      'project:read',
      'project:admin',
    ];
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    const enableSpendAllocations = await screen.findByRole('button', {
      name: 'Get started',
    });
    expect(mockGet).toHaveBeenCalledTimes(1);

    MockApiClient.clearMockResponses();
    const toggleRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/toggle/`,
      method: 'POST',
    });
    const createAllocationsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/index/`,
      method: 'POST',
    });
    const mockGet_success = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: [],
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });

    await userEvent.click(enableSpendAllocations);
    expect(toggleRequestMock).toHaveBeenCalled();
    expect(createAllocationsRequestMock).toHaveBeenCalled();
    expect(mockGet_success).toHaveBeenCalledTimes(2);
  });
});

describe('enabled Spend Allocations page', () => {
  let organization: any, subscription: any, dateTs: any;
  beforeEach(() => {
    organization = initializeOrg({
      organization: {
        features: ['spend-allocations'],
      },
    }).organization;
    organization.access = [
      'org:read',
      'org:write',
      'org:admin',
      'org:billing',
      'project:read',
      'project:admin',
    ];
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      planTier: 'am1',
    });
    MockApiClient.clearMockResponses();
    dateTs = Math.max(
      new Date().getTime() / 1000,
      new Date(subscription.onDemandPeriodStart + 'T00:00:00.000').getTime() / 1000
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: mockSpendAllocations,
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });
  });

  it('Does not render with insufficient access', async () => {
    organization.access = ['org:read'];
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    // Waiting a tick for requests to finish
    await act(tick);
    expect(screen.queryByTestId('spend-allocation-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('subhead-actions')).not.toBeInTheDocument();
  });

  it('renders allocations table', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    await waitFor(() => screen.findByTestId('allocations-table'));
  });

  it('renders billing metric select dropdown', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    expect(
      await screen.findByRole('button', {name: 'Category Errors'})
    ).toBeInTheDocument();
  });

  it('properly filters allocations by select dropdown', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );

    const dropdown = await screen.findByRole('button', {name: 'Category Errors'});
    await selectEvent.select(dropdown, 'Transactions');
    expect(
      await screen.findByRole('button', {name: 'Category Transactions'})
    ).toBeInTheDocument();
    await screen.findByText('Un-Allocated Transactions Pool');
    await screen.findAllByTestId('allocation-row');
    const tableRows = screen.getAllByTestId('allocation-row');
    expect(tableRows).toHaveLength(1); // org allocations are no longer included in table rows

    await selectEvent.select(dropdown, 'Attachments');
    expect(
      await screen.findByRole('button', {name: 'Category Attachments'})
    ).toBeInTheDocument();
    await screen.findByText('Un-Allocated Attachments Pool');
    expect(screen.getByTestId('no-allocations')).toBeInTheDocument();

    await selectEvent.openMenu(dropdown);
    // assert dropdown options are properly rendered
    // This is hacky. the CompactSelect component sets the option value as the test-id
    expect(screen.getByTestId('errors')).toBeInTheDocument();
    expect(screen.getByTestId('transactions')).toBeInTheDocument();
    expect(screen.getByTestId('attachments')).toBeInTheDocument();
  });

  it('only renders allocation-supported categories that are on the subscription', async () => {
    const am3Sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: 'am3',
    });
    render(<SpendAllocationsRoot organization={organization} subscription={am3Sub} />);

    const dropdown = await screen.findByRole('button', {name: 'Category Errors'});
    await selectEvent.openMenu(dropdown);
    expect(screen.getByTestId('errors')).toBeInTheDocument();
    expect(screen.queryByTestId('transactions')).not.toBeInTheDocument();
    expect(screen.getByTestId('attachments')).toBeInTheDocument();
  });

  // NOTE: Period navigation has been removed for now
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('refetches allocations on view period change', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    await screen.findAllByTestId('allocation-row');
    const tableRows = screen.getAllByTestId('allocation-row');
    expect(tableRows).toHaveLength(2); // default metric is error with 2 project mocks

    const date = new Date(dateTs * 1000);
    date.setMonth(date.getMonth() + 1);
    const start = new Date(subscription.onDemandPeriodEnd + 'T00:00:00.000');
    start.setDate(start.getDate() + 1);
    const nextTs = Math.max(date.getTime() / 1000, new Date(start).getTime() / 1000);

    const mockGet_success = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: mockRootAllocations,
      status: 200,
      statusCode: 200,
      match: [
        MockApiClient.matchQuery({
          timestamp: nextTs,
        }),
      ],
    });
    await userEvent.click(screen.getByTestId('nextPeriod'));
    expect(await screen.findByTestId('no-allocations')).toBeInTheDocument();
    expect(mockGet_success).toHaveBeenCalledTimes(1);
  });

  it('deletes allocations on disable', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    await waitFor(() => screen.findByTestId('allocations-table'));
    expect(
      screen.queryByRole('button', {
        name: 'Create Organization-Level Allocation',
      })
    ).not.toBeInTheDocument();

    MockApiClient.clearMockResponses();
    const mockDelete = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/index/`,
      method: 'DELETE',
    });
    const mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: [],
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Disable Spend Allocations',
      })
    );
    renderGlobalModal();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Confirm',
      })
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe('enabled Spend Allocations page without root', () => {
  let organization: any, subscription: any, dateTs: any, mockGet: any;
  beforeEach(() => {
    organization = initializeOrg({
      organization: {
        features: ['spend-allocations'],
      },
    }).organization;
    organization.access = [
      'org:read',
      'org:write',
      'org:admin',
      'org:billing',
      'project:read',
      'project:admin',
    ];
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      planTier: 'am1',
    });
    MockApiClient.clearMockResponses();
    dateTs = Math.max(
      new Date().getTime() / 1000,
      new Date(subscription.onDemandPeriodStart + 'T00:00:00.000').getTime() / 1000
    );
    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: [],
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });
  });

  it('renders missing root card', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
    await screen.findByTestId('missing-root');
  });

  it('creates root allocation for billing metric', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );

    await screen.findByRole('button', {
      name: 'Create Organization-Level Allocation',
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
    const enableSpendAllocation = screen.getByRole('button', {
      name: 'Create Organization-Level Allocation',
    });

    MockApiClient.clearMockResponses();
    const requestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'POST',
    });
    const mockGet_success = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: mockRootAllocations,
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });

    await userEvent.click(enableSpendAllocation);
    expect(requestMock).toHaveBeenCalled();
    expect(mockGet_success).toHaveBeenCalledTimes(2);
  });
});

describe('POST Create spend allocation', () => {
  let organization: any, subscription: any, projects: any, mockPost: any, dateTs: number;
  beforeEach(() => {
    projects = [
      ProjectFixture({
        id: String(mockSpendAllocations[3]!.targetId),
        slug: mockSpendAllocations[3]!.targetSlug,
      }),
      ProjectFixture({
        id: String(mockSpendAllocations[4]!.targetId),
        slug: mockSpendAllocations[4]!.targetSlug,
      }),
      ProjectFixture({
        // transaction allocation
        id: String(mockSpendAllocations[5]!.targetId),
        slug: mockSpendAllocations[5]!.targetSlug,
      }),
    ];
    organization = initializeOrg({
      organization: {
        features: ['spend-allocations'],
      },
    }).organization;
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      planTier: 'am1',
    });
    MockApiClient.clearMockResponses();
    dateTs = Math.max(
      new Date().getTime() / 1000,
      new Date(subscription.onDemandPeriodStart + 'T00:00:00.000').getTime() / 1000
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: mockSpendAllocations,
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });
    mockPost = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'POST',
      status: 200,
      statusCode: 200,
    });
    ProjectsStore.loadInitialData(projects);
  });

  it('opens and closes form', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    expect(
      await screen.findByRole('button', {name: 'New Allocation'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByText('New Allocation'));
    const {waitForModalToHide} = renderGlobalModal();
    expect(await screen.findByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByTestId('spend-allocation-form')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Cancel'));
    await waitForModalToHide();

    expect(
      await screen.findByRole('button', {name: 'New Allocation'})
    ).toBeInTheDocument();
    expect(screen.queryByTestId('spend-allocation-form')).not.toBeInTheDocument();
  });

  it('filters target project list', async () => {
    // TODO: figure out how to write tests for SelectField component.
  });

  it('prevents submit on incomplete form', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    expect(
      await screen.findByRole('button', {name: 'New Allocation'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText('New Allocation'));
    renderGlobalModal();

    await userEvent.click(screen.getByText('Submit'));

    expect(mockPost.mock.calls).toHaveLength(0);
  });
});

describe('Disable Submit button in Spend Allocation', () => {
  let organization: any, subscription: any, projects: any, dateTs: number;
  beforeEach(() => {
    projects = [
      ProjectFixture({
        id: String(mockSpendAllocations[3]!.targetId),
        slug: mockSpendAllocations[3]!.targetSlug,
      }),
      ProjectFixture({
        id: String(mockSpendAllocations[4]!.targetId),
        slug: mockSpendAllocations[4]!.targetSlug,
      }),
      ProjectFixture({
        // transaction allocation
        id: String(mockSpendAllocations[5]!.targetId),
        slug: mockSpendAllocations[5]!.targetSlug,
      }),
    ];
    organization = initializeOrg({
      organization: {
        features: ['spend-allocations'],
      },
    }).organization;
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      planTier: 'am1',
    });
    MockApiClient.clearMockResponses();
    dateTs = Math.max(
      new Date().getTime() / 1000,
      new Date(subscription.onDemandPeriodStart + 'T00:00:00.000').getTime() / 1000
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: [],
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });
    ProjectsStore.loadInitialData(projects);
  });

  it('prevents submit with no root allocations', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    expect(
      await screen.findByRole('button', {name: 'New Allocation'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText('New Allocation'));
    renderGlobalModal();

    await userEvent.click(screen.getByText('Select a project to continue'));
    expect(screen.getByText(projects[0].slug)).toBeInTheDocument();
    await userEvent.click(screen.getByText(projects[0].slug));

    expect(screen.getByTestId('spend-allocation-submit')).toBeDisabled();
  });
});

describe('DELETE spend allocation', () => {
  let organization: any, subscription: any, mockDelete: any, mockGet: any, dateTs: number;
  beforeEach(() => {
    organization = initializeOrg({
      organization: {
        features: ['spend-allocations'],
      },
    }).organization;
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      planTier: 'am1',
    });
    MockApiClient.clearMockResponses();
    dateTs = Math.max(
      new Date().getTime() / 1000,
      new Date(subscription.onDemandPeriodStart + 'T00:00:00.000').getTime() / 1000
    );
    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: mockSpendAllocations,
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });
    mockDelete = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'DELETE',
      status: 200,
      statusCode: 200,
      match: [
        MockApiClient.matchQuery({
          billing_metric: 'error',
          target_id: 1,
          target_type: 'Project',
        }),
      ],
    });
  });
  it('renders delete button for project allocations', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    await screen.findAllByTestId('allocation-row');
    const tableRows = screen.getAllByTestId('allocation-row');
    expect(tableRows).toHaveLength(2);
    expect(within(tableRows[0]!).getByTestId('delete')).toBeInTheDocument();
    expect(within(tableRows[1]!).getByTestId('delete')).toBeInTheDocument();
  });
  it('fires delete request on click', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    expect(mockGet.mock.calls).toHaveLength(1);
    await screen.findAllByTestId('allocation-row');
    const tableRows = screen.getAllByTestId('allocation-row');
    await userEvent.click(within(tableRows[0]!).getByTestId('delete'));

    expect(mockDelete.mock.calls).toHaveLength(1);
    // Assert that it refetches allocations on success
    expect(mockGet.mock.calls).toHaveLength(4);
  });
});

describe('PUT edit spend allocation', () => {
  let organization: any, subscription: any, projects: any, mockPut: any, dateTs: number;
  beforeEach(() => {
    projects = [
      ProjectFixture({
        id: String(mockSpendAllocations[2]!.targetId),
        slug: mockSpendAllocations[2]!.targetSlug,
      }),
      ProjectFixture({
        id: String(mockSpendAllocations[3]!.targetId),
        slug: mockSpendAllocations[3]!.targetSlug,
      }),
      ProjectFixture({
        // transaction allocation
        id: String(mockSpendAllocations[4]!.targetId),
        slug: mockSpendAllocations[4]!.targetSlug,
      }),
    ];
    organization = initializeOrg({
      organization: {
        features: ['spend-allocations'],
      },
    }).organization;
    subscription = SubscriptionFixture({
      organization,
      plan: 'am1_f',
      planTier: 'am1',
    });
    MockApiClient.clearMockResponses();
    dateTs = Math.max(
      new Date().getTime() / 1000,
      new Date(subscription.onDemandPeriodStart + 'T00:00:00.000').getTime() / 1000
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'GET',
      body: mockSpendAllocations,
      status: 200,
      statusCode: 200,
      match: [MockApiClient.matchQuery({timestamp: dateTs})],
    });
    mockPut = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spend-allocations/`,
      method: 'PUT',
      status: 200,
      statusCode: 200,
    });
    ProjectsStore.loadInitialData(projects);
  });

  it('opens, initializes form on edit, and submits PUT', async () => {
    render(
      <SpendAllocationsRoot organization={organization} subscription={subscription} />
    );
    await screen.findAllByTestId('allocation-row');
    const tableRows = screen.getAllByTestId('allocation-row');
    expect(tableRows).toHaveLength(2);
    expect(within(tableRows[0]!).getByTestId('edit')).toBeInTheDocument();

    // Should be editing the first 'error' allocation (mockSpendAllocations[2])
    await userEvent.click(within(tableRows[0]!).getByTestId('edit'));
    renderGlobalModal();

    expect(await screen.findByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByTestId('spend-allocation-form')).toBeInTheDocument();

    // Mock currently only includes a single project NOT allocated for errors
    expect(screen.queryAllByTestId('badge-display-name')).toHaveLength(1);

    expect(screen.getByTestId('allocation-input')).toHaveValue(
      mockSpendAllocations[2]!.reservedQuantity
    );

    expect(screen.getByTestId('toggle-spend')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('toggle-spend'));

    expect(screen.getByTestId('allocation-input')).toHaveValue(
      (mockSpendAllocations[2]!.reservedQuantity! *
        mockSpendAllocations[2]!.costPerItem!) /
        100
    );

    await userEvent.click(screen.getByText('Save Changes'));

    expect(mockPut.mock.calls).toHaveLength(1);
  });
});
