import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import AuditLogView from 'app/views/settings/organization/auditLog/auditLogView';

jest.mock('jquery');

describe('AuditLogView', function() {
  let org = TestStubs.Organization();
  const ENDPOINT = `/organizations/${org.slug}/audit-logs/`;

  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.AuditLogs(),
    });
  });

  it('renders', function(done) {
    let wrapper = shallow(
      <AuditLogView location={{query: ''}} params={{orgId: org.slug}} />,
      TestStubs.routerContext()
    );

    wrapper.setState({loading: false});
    wrapper.update();
    setTimeout(() => {
      wrapper.update();
      expect(wrapper).toMatchSnapshot();
      done();
    });
  });
});
