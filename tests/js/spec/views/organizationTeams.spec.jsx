var React = require("react/addons");
var Cookies = require("js-cookie");

var api = require("app/api");
var OrganizationTeams = require("app/views/organizationTeams");
var stubReactComponents = require("../../helpers/stubReactComponent");
var stubRouter = require("../../helpers/stubRouter");
var stubContext = require("../../helpers/stubContext");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

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
