import React from "react/addons";
import api from "app/api";
import OrganizationTeams from "app/views/organizationTeams";
import stubRouter from "../../helpers/stubRouter";
import stubContext from "../../helpers/stubContext";

describe("OrganizationTeams", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(api, "request");

    var ContextStubbedOrganizationTeams = stubContext(OrganizationTeams, {
      organization: { id: 1337 },
      router: stubRouter({
        getCurrentParams() {
          return { orgId: "123" };
        },
        getCurrentQuery() {
          return { limit: 0 };
        }
      })
    });

    this.Element = <ContextStubbedOrganizationTeams/>;
  });

  afterEach(function() {
    this.sandbox.restore();
    React.unmountComponentAtNode(document.body);
  });

  describe("fetchStats()", function() {
    it('should make a request to the organizations endpoint', function () {
      var organizationTeams = React.render(this.Element, document.body).refs.wrapped;

      // NOTE: creation of OrganizationTeams causes a bunch of API requests to fire ...
      //       reset the request stub so that we can get an accurate count
      this.stubbedApiRequest.reset();

      organizationTeams.fetchStats();

      expect(this.stubbedApiRequest.callCount).to.equal(1);
      expect(this.stubbedApiRequest.getCall(0).args[0]).to.equal('/organizations/123/stats/');
    });
  });
});

