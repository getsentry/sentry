var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");
var jQuery = require("jquery");

var api = require("../api");
var Count = require("../components/count");
var DocumentTitle = require("react-document-title");
var EventEntries = require("../components/eventEntries");
var Footer = require("../components/footer");
var Header = require("../components/header");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");

var SharedGroupHeader = React.createClass({
  render() {
    var group = this.props.group,
        userCount = 0;

    if (group.tags["sentry:user"] !== undefined) {
      userCount = group.tags["sentry:user"].count;
    }

    return (
      <div className="group-detail">
        <div className="row">
          <div className="col-sm-9 details">
            <h3>
              {group.title}
            </h3>
            <div className="event-message">
              <span className="message">{group.culprit}</span>
            </div>
          </div>
          <div className="col-sm-3 stats">
            <div className="row">
              <div className="col-xs-6 count align-right">
                <h6 className="nav-header">events</h6>
                <Count value={group.count} />
              </div>
              <div className="col-xs-6 count align-right">
                <h6 className="nav-header">users</h6>
                <Count value={userCount} />
              </div>
            </div>
          </div>
        </div>
        <ul className="nav nav-tabs">
          <li className="active"><a>Overview</a></li>
        </ul>
      </div>
    );
  }
});

var SharedGroupDetails = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

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

  getTitle() {
    if (this.state.group)
      return this.state.group.title + ' | Sentry';
    return 'Sentry';
  },

  componentWillMount() {
    this.fetchData();
    jQuery(document.body).addClass("shared-group");
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass("shared-group");
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getGroupDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          loading: false,
          group: data
        });
      }, error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  getGroupDetailsEndpoint() {
    var id = this.context.router.getCurrentParams().shareId;

    return '/shared/groups/' + id + '/';
  },

  render() {
    var group = this.state.group;

    if (this.state.loading || !group)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    var evt = this.state.group.latestEvent;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <Header />
          <div className="container">
            <div className="content">
              <SharedGroupHeader group={group} />
              <div className="group-overview">
                <EventEntries group={group} event={evt} isShare={true} />
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </DocumentTitle>
    );
  }
});

module.exports = SharedGroupDetails;
