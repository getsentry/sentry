import React from 'react';
import {shallow} from 'sentry-test/enzyme';

import DataExport from 'app/components/dataExport';

describe('DataExport', function() {
  const mockUnauthorizedOrg = TestStubs.Organization({
    features: [''],
  });
  // const mockAuthorizedOrg = TestStubs.Organization({
  //   features: ['data-export'],
  // });
  const mockPayload = {
    query_type: 2,
    query_info: {project_id: '1', group_id: '1027', key: 'user'},
  };

  it('should not render anything for an unauthorized organization', function() {
    const wrapper = shallow(
      <DataExport organization={mockUnauthorizedOrg} payload={mockPayload} />
    );
    expect(wrapper.isEmptyRender()).toBe(false);
  });
});
