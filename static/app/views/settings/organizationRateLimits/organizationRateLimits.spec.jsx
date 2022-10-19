import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationRateLimits from 'sentry/views/settings/organizationRateLimits/organizationRateLimits';

const ENDPOINT = '/organizations/org-slug/';

describe('Organization Rate Limits', function () {
  const organization = {
    ...TestStubs.Organization(),
    quota: {
      projectLimit: 75,
      accountLimit: 70000,
    },
  };

  const renderComponent = props =>
    render(<OrganizationRateLimits organization={organization} {...props} />);

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
    const org = {
      ...organization,
      quota: {
        maxRate: 100,
        maxRateInterval: 60,
      },
    };

    const {container} = renderComponent({organization: org});

    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(container).toSnapshot();
  });

  it('can change Account Rate Limit', function () {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    renderComponent();

    expect(mock).not.toHaveBeenCalled();

    // Change Account Limit
    // Remember value needs to be an index of allowedValues for account limit
    const slider = screen.getByRole('slider', {name: 'Account Limit'});
    fireEvent.change(slider, {target: {value: 11}});
    userEvent.click(slider);
    userEvent.tab();

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

  it('can change Project Rate Limit', function () {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    renderComponent();

    expect(mock).not.toHaveBeenCalled();

    // Change Project Rate Limit
    const slider = screen.getByRole('slider', {name: 'Per-Project Limit'});
    fireEvent.change(slider, {target: {value: 100}});
    userEvent.click(slider);
    userEvent.tab();

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
