var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var GroupHeader = require("./groupDetails/header");
var GroupStore = require("../stores/groupStore");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");
var utils = require("../utils");

var SharedGroupDetails = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    Reflux.listenTo(GroupStore, "onGroupChange")
  ],

  childContextTypes: {
    group: PropTypes.Group,
  },

  getChildContext() {
    return {
      group: this.state.group,
    };
  },

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getGroupDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          loading: false
        });
        GroupStore.loadInitialData([data]);
      }, error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  onGroupChange(itemIds) {
    var id = this.context.router.getCurrentParams().groupId;
    if (itemIds.has(id)) {
      this.setState({
        group: GroupStore.get(id),
      });
    }
  },

  getGroupDetailsEndpoint() {
    var id = this.context.router.getCurrentParams().shareId;

    return '/groups/?shareId=' + id;
  },

  render() {
    var group = this.state.group;
    var params = this.context.router.getCurrentParams();

    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    return (
      <div className={this.props.className}>
        Group Details
      </div>
    );
  }
});

module.exports = SharedGroupDetails;
