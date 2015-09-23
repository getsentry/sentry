import React from "react";
import TestUtils from "react-addons-test-utils";
import api from "app/api";
import OrganizationTeams from "app/views/organizationTeams";
import ExpandedTeamList from "app/views/organizationTeams/expandedTeamList";
import AllTeamsList from "app/views/organizationTeams/allTeamsList";
import OrganizationHomeContainer from "app/components/organizations/homeContainer";

import stubReactComponent from "../../helpers/stubReactComponent";
import stubContext from "../../helpers/stubContext";

describe("OrganizationTeams", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(api, "request");
    stubReactComponent(this.sandbox, [ExpandedTeamList, AllTeamsList, OrganizationHomeContainer]);

    var ContextStubbedOrganizationTeams = stubContext(OrganizationTeams, {
      organization: { id: "1337" }
    });

    this.Element = <ContextStubbedOrganizationTeams params={{orgId:"123"}}/>;
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("fetchStats()", function() {
    it('should make a request to the organizations endpoint', function () {
      var organizationTeams = TestUtils.renderIntoDocument(this.Element).refs.wrapped;

      // NOTE: creation of OrganizationTeams causes a bunch of API requests to fire ...
      //       reset the request stub so that we can get an accurate count
      this.stubbedApiRequest.reset();

      organizationTeams.fetchStats();

      expect(this.stubbedApiRequest.callCount).to.equal(1);
      expect(this.stubbedApiRequest.getCall(0).args[0]).to.equal('/organizations/123/stats/');
    });
  });
});

