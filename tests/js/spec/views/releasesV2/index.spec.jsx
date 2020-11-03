import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ReleasesV2Container from 'app/views/releasesV2';

describe('ReleasesV2Container', function () {
  it('it displays no access message', function () {
    const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
    const wrapper = mountWithTheme(
      <ReleasesV2Container />,
      TestStubs.routerContext([{organization}])
    );
    expect(wrapper.text()).toBe("You don't have access to this feature");
  });
});
