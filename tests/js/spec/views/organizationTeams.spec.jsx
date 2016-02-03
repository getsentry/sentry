import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import OrganizationTeams from 'app/views/organizationTeams';

describe('OrganizationTeams', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('fetchStats()', function() {
    it('should make a request to the organizations endpoint', function () {
      let organizationTeams = shallow(<OrganizationTeams params={{orgId:'123'}}/>, {
        organization: {id: '1337'}
      }).instance();

      // NOTE: creation of OrganizationTeams causes a bunch of API requests to fire ...
      //       reset the request stub so that we can get an accurate count
      this.stubbedApiRequest.reset();

      organizationTeams.fetchStats();

      expect(this.stubbedApiRequest.callCount).to.equal(1);
      expect(this.stubbedApiRequest.getCall(0).args[0]).to.equal('/organizations/123/stats/');
    });
  });
});

