import {Organization} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationRateLimits, {
  OrganizationRateLimitProps,
} from 'sentry/views/settings/organizationRateLimits/organizationRateLimits';

const ENDPOINT = '/organizations/org-slug/';

describe('Organization Rate Limits', function () {
  const organization = Organization({
    quota: {
      projectLimit: 75,
      accountLimit: 70000,
      maxRate: null,
      maxRateInterval: null,
    },
  });

  const renderComponent = (props?: Partial<OrganizationRateLimitProps>) =>
    render(
      <OrganizationRateLimits
        {...RouteComponentPropsFixture()}
        organization={organization}
        {...props}
      />
    );

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders with initialData', function () {
    renderComponent();

    // XXX: Slider input values are associated to their step value
    // Step 16 is 70000
    expect(screen.getByRole('slider', {name: 'Account Limit'})).toHaveValue('16');
    expect(screen.getByRole('slider', {name: 'Per-Project Limit'})).toHaveValue('75');
  });

  it('renders with maxRate and maxRateInterval set', function () {
    const org = Organization({
      ...organization,
      quota: {
        maxRate: 100,
        maxRateInterval: 60,
        projectLimit: null,
        accountLimit: null,
      },
    });

    renderComponent({organization: org});

    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('can change Account Rate Limit', async function () {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    renderComponent();

    expect(mock).not.toHaveBeenCalled();

    // Change Account Limit
    screen.getByRole('slider', {name: 'Account Limit'}).focus();
    await userEvent.keyboard('{ArrowLeft>5}');
    await userEvent.tab();

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          accountRateLimit: 20000,
        },
      })
    );
  });

  it('can change Project Rate Limit', async function () {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    renderComponent();

    expect(mock).not.toHaveBeenCalled();

    // Change Project Rate Limit
    screen.getByRole('slider', {name: 'Per-Project Limit'}).focus();
    await userEvent.keyboard('{ArrowRight>5}');
    await userEvent.tab();

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          projectRateLimit: 100,
        },
      })
    );
  });
});
