var React = require("react");
var {Link} = require("react-router");

var ApiMixin = require("../mixins/apiMixin");
var Count = require("../components/count");
var GroupState = require("../mixins/groupState");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");

var GroupTags = React.createClass({
  mixins: [
    ApiMixin,
    GroupState
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    return {
      tagList: null,
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

    // TODO(dcramer): each tag should be a separate query as the tags endpoint
    // is not performant
    this.apiRequest('/groups/' + this.getGroup().id + '/tags/', {
      success: (data) => {
        if (!this.isMounted()) {
          return;
        }
        this.setState({
          tagList: data,
          error: false,
          loading: false
        });
      },
      error: (error) => {
        if (!this.isMounted()) {
          return;
        }
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    var children = [];
    var router = this.context.router;

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        var valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          var pct = parseInt(tagValue.count / tag.totalValues * 100, 10);
          var params = router.getCurrentParams();
          return (
            <li key={tagValueIdx}>
              <Router.Link
                  className="tag-bar"
                  to="stream"
                  params={params}
                  query={{query: tag.key + ':' + '"' + tagValue.value + '"'}}>
                <span className="tag-bar-background" style={{width: pct + '%'}}></span>
                <span className="tag-bar-label">{tagValue.name}</span>
                <span className="tag-bar-count"><Count value={tagValue.count} /></span>
              </Router.Link>
            </li>
          );
        });

        var routeParams = {
          orgId: this.getOrganization().slug,
          projectId: this.getProject().slug,
          groupId: this.getGroup().id,
          tagKey: tag.key
        };

        return (
          <div className="col-md-6" key={tagIdx}>
            <div className="box">
              <div className="box-header">
                <span className="pull-right">
                  <Link to="groupTagValues" params={routeParams}>More Details</Link>
                </span>
                <h5>{tag.name} (<Count value={tag.uniqueValues} />)</h5>
              </div>
              <div className="box-content with-padding">
                <ul className="list-unstyled">
                  {valueChildren}
                </ul>
              </div>
            </div>
          </div>
        );
      });
    }

    return (
      <div>
        <h5>Values seen in the last 7 days.</h5>
        <div className="row">
          {children}
        </div>
      </div>
    );
  }
});

module.exports = GroupTags;
