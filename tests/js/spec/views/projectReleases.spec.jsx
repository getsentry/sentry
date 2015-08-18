var React = require("react/addons");
var TestUtils = React.addons.TestUtils;

var stubReactComponents = require("../../helpers/stubReactComponent");
var stubContext = require("../../helpers/stubContext");
var stubRouter = require("../../helpers/stubRouter");

var api = require("app/api");

var ProjectReleases = require("app/views/projectReleases");
var SearchBar = require("app/views/stream/searchBar");
var Pagination = require("app/components/pagination");

describe("ProjectReleases", function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(api, "request");
    stubReactComponents(this.sandbox, [SearchBar, Pagination]);

    this.ContextStubbedProjectReleases = stubContext(ProjectReleases, {
      router: stubRouter({
        getCurrentParams() {
          return {
            orgId: "123",
            projectId: "456"
          };
        },
        getCurrentQuery() {
          return {
            limit: 0,
            query: "derp"
          };
        }
      })
    });
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe("fetchData()", function () {
    it("should call releases endpoint", function () {
      TestUtils.renderIntoDocument(
        <this.ContextStubbedProjectReleases setProjectNavSection={function(){}}/>
      );

      expect(api.request.args[0][0]).to.equal('/projects/123/456/releases/?limit=50&query=derp');
    });
  });

  describe("getInitialState()", function () {
    it("should take query state from query string", function () {
      TestUtils.renderIntoDocument(
        <this.ContextStubbedProjectReleases setProjectNavSection={function(){}}/>
      );

      var projectReleases = TestUtils.renderIntoDocument(
        <this.ContextStubbedProjectReleases setProjectNavSection={function(){}}/>
      ).refs.wrapped;

      expect(projectReleases.state.query).to.equal("derp");
    });
  });

  describe("onSearch", function () {
    it("should change query string with new search parameter", function () {
      var projectReleases = TestUtils.renderIntoDocument(
        <this.ContextStubbedProjectReleases setProjectNavSection={function(){}}/>
      ).refs.wrapped;

      var router = this.sandbox.stub(projectReleases.context.router, 'transitionTo');

      projectReleases.onSearch("searchquery");

      expect(router.calledOnce).to.be.ok;
      expect(router.args[0]).to.eql([
        "projectReleases",
        { orgId: "123", projectId: "456" },
        { query: "searchquery" }
      ]);
    });
  });

  describe("routeDidChange()", function () {
    it("should update state with latest query pulled from query string", function () {
      var projectReleases = TestUtils.renderIntoDocument(
        <this.ContextStubbedProjectReleases setProjectNavSection={function(){}}/>
      ).refs.wrapped;

      this.sandbox.stub(projectReleases.context.router, 'getCurrentQuery').returns({
        query: "newquery"
      });

      projectReleases.routeDidChange();

      expect(projectReleases.state.query).to.eql("newquery");
    });
  });
});