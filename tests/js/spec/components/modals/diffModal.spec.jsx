import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import DiffModal from 'app/components/modals/diffModal';

describe('DiffModal', function() {
  it('renders', function() {
    const wrapper = mountWithTheme(
      <DiffModal
        orgId="123"
        baseIssueId="123"
        targetIssueId="234"
        projectId="projectId"
        Body={({children}) => <div>{children}</div>}
      />
    );
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });
});
