/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var AggregateHeader = require("./aggregate/header");
var AggregateListStore = require("../stores/aggregateListStore");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var utils = require("../utils");

var AggregateDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Reflux.listenTo(AggregateListStore, "onAggListChange"),
    Router.State
  ],

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired
  },

  onAggListChange() {
    var id = this.getParams().aggregateId;

    this.setState({
      aggregate: AggregateListStore.getItem(id)
    });
  },

  getInitialState() {
    return {
      aggregate: null,
      statsPeriod: '48h'
    };
  },

  componentWillMount() {
    api.request(this.getAggregateDetailsEndpoint(), {
      success: (data) => {
        AggregateListStore.loadInitialData([data]);

        this.setBreadcrumbs([
          {name: data.title, to: 'aggregateDetails'}
        ]);
      }
    });
  },

  getAggregateDetailsEndpoint() {
    return '/groups/' + this.getParams().aggregateId + '/';
  },

  render() {
    var aggregate = this.state.aggregate;
    var params = this.getParams();

    if (!aggregate) {
      return <div />;
    }

    return (
      <div className={this.props.className}>
        <AggregateHeader
            orgId={params.orgId}
            projectId={params.projectId}
            aggregate={aggregate}
            statsPeriod={this.state.statsPeriod}
            memberList={this.props.memberList} />
        <Router.RouteHandler
            memberList={this.props.memberList}
            aggregate={aggregate}
            statsPeriod={this.state.statsPeriod} />
      </div>
    );
  }
});

module.exports = AggregateDetails;
