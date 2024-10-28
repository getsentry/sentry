import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EditAccessSelector from './editAccessSelector';

function renderTestComponent(initialData) {
  render(
    <EditAccessSelector
      dashboard={DashboardFixture([], {id: '1', title: 'Custom Errors'})}
      onChangeEditAccess={jest.fn()}
    />,
    {
      router: initialData.router,
      organization: {
        features: ['dashboards-edit-access', 'dashboards-edit'],
        ...initialData.organization,
      },
    }
  );
}

describe('When EditAccessSelector is rendered', () => {
  let initialData;
  const organization = OrganizationFixture({
    features: ['global-views', 'dashboards-basic', 'dashboards-edit', 'discover-query'],
  });
  beforeEach(() => {
    window.confirm = jest.fn();

    initialData = initializeOrg({
      organization,
      router: {
        location: LocationFixture(),
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {
          ...DashboardFixture([], {
            id: 'default-overview',
            title: 'Default',
          }),
          widgetDisplay: ['area'],
        },
        {
          ...DashboardFixture([], {
            id: '1',
            title: 'Custom Errors',
          }),
          widgetDisplay: ['area'],
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      body: DashboardFixture([], {
        id: '1',
        title: 'Custom Errors',
        filters: {},
      }),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with creator and everyone options', async function () {
    renderTestComponent(initialData);

    await userEvent.click(await screen.findByText('Edit Access:'));
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('Everyone')).toBeInTheDocument();
  });
});
