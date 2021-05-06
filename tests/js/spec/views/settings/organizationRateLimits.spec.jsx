import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import OrganizationRateLimits from 'app/views/settings/organizationRateLimits/organizationRateLimits';

const ENDPOINT = '/organizations/org-slug/';

describe('Organization Rate Limits', function () {
  const organization = {
    ...TestStubs.Organization(),
    quota: {
      projectLimit: 75,
      accountLimit: 70000,
    },
  };

  const creator = props => (
    <OrganizationRateLimits organization={organization} {...props} />
  );

  beforeEach(function () {
    Client.clearMockResponses();
  });

  it('renders with initialData', function () {
    const wrapper = mountWithTheme(creator(), TestStubs.routerContext());

    expect(wrapper.find('RangeSlider').first().prop('value')).toBe(70000);
    expect(wrapper.find('RangeSlider').at(1).prop('value')).toBe(75);
  });

  it('renders with maxRate and maxRateInterval set', function () {
    const org = {
      ...organization,
      quota: {
        maxRate: 100,
        maxRateInterval: 60,
      },
    };
    const wrapper = mountWithTheme(
      creator({organization: org}),
      TestStubs.routerContext()
    );

    expect(wrapper.find('RangeSlider')).toHaveLength(1);

    expect(wrapper.find('Form TextBlock')).toSnapshot();
  });

  it('can change Account Rate Limit', function () {
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    const wrapper = mountWithTheme(creator(), TestStubs.routerContext());

    expect(mock).not.toHaveBeenCalled();

    // Change Account Limit
    // Remember value needs to be an index of allowedValues for account limit
    wrapper
      .find('RangeSlider Slider')
      .first()
      .simulate('input', {target: {value: 11}})
      .simulate('mouseUp', {target: {value: 11}});

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
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    const wrapper = mountWithTheme(creator(), TestStubs.routerContext());

    expect(mock).not.toHaveBeenCalled();

    // Change Project Rate Limit
    wrapper
      .find('RangeSlider Slider')
      .at(1)
      .simulate('input', {target: {value: 100}})
      .simulate('mouseUp', {target: {value: 100}});

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
