import {enzymeRender} from 'sentry-test/enzyme';

import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';

describe('ApiTokenRow', function () {
  it('renders', function () {
    const wrapper = enzymeRender(
      <ApiTokenRow onRemove={() => {}} token={TestStubs.ApiToken()} />
    );

    // Should be loading
    expect(wrapper).toSnapshot();
  });

  it('calls onRemove callback when trash can is clicked', function () {
    const cb = jest.fn();
    const wrapper = enzymeRender(
      <ApiTokenRow onRemove={cb} token={TestStubs.ApiToken()} />
    );

    wrapper.find('Button').simulate('click');
    expect(cb).toHaveBeenCalled();
  });
});
