import {mount} from 'sentry-test/enzyme';

import NarrowLayout from 'app/components/narrowLayout';

describe('NarrowLayout', function () {
  beforeAll(function () {
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});
  });
  afterAll(function () {
    window.location.assign.mockRestore();
  });

  it('renders without logout', function () {
    const wrapper = mount(<NarrowLayout />);
    expect(wrapper.find('a.logout')).toHaveLength(0);
  });

  it('renders with logout', function () {
    const wrapper = mount(<NarrowLayout showLogout />);
    expect(wrapper.find('a.logout')).toHaveLength(1);
  });

  it('can logout', function () {
    const mock = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      status: 204,
    });
    const wrapper = mount(<NarrowLayout showLogout />);

    wrapper.find('a.logout').simulate('click');
    expect(mock).toHaveBeenCalled();
  });
});
