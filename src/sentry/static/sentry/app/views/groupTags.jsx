/*** @jsx React.DOM */

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

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        var valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          var pct = parseInt(tagValue.count / tag.totalValues * 100, 10);
          return (
            <li key={tagValueIdx}>
              <a className="tag-bar" href="">
                <span className="tag-bar-background" style={{width: pct + '%'}}></span>
                <span className="tag-bar-label">{tagValue.value}</span>
                <span className="tag-bar-count"><Count value={tagValue.count} /></span>
              </a>
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
