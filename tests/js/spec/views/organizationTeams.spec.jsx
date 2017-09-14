import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import OrganizationTeams from 'app/views/organizationTeams';

describe('OrganizationTeams', function() {
  let sandbox;
  let stubbedApiRequest;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    stubbedApiRequest = sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('fetchStats()', function() {
    it('should make a request to the organizations endpoint', function() {
      let organizationTeams = shallow(<OrganizationTeams params={{orgId: '123'}} />, {
        organization: {id: '1337'},
      }).instance();

      // NOTE: creation of OrganizationTeams causes a bunch of API requests to fire ...
      //       reset the request stub so that we can get an accurate count
      stubbedApiRequest.reset();

      organizationTeams.fetchStats();

      expect(stubbedApiRequest.callCount).toEqual(1);
      expect(stubbedApiRequest.getCall(0).args[0]).toEqual('/organizations/123/stats/');
    });
  });
});
