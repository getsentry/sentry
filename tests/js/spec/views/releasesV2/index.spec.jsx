import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import ReleasesV2Container from 'app/views/releasesV2';
import * as releaseUtils from 'app/views/releasesV2/utils';

describe('ReleasesV2Container', function() {
  it('it redirects to v1 when feature not enabled', function() {
    location.reload = jest.fn();
    releaseUtils.switchReleasesVersion = jest.fn();

    const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
    mountWithTheme(<ReleasesV2Container />, TestStubs.routerContext([{organization}]));
    expect(location.reload).toHaveBeenCalled();
    expect(releaseUtils.switchReleasesVersion).toHaveBeenCalledWith('1', '3');
  });
});
