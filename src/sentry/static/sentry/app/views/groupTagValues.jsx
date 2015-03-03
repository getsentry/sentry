/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var Count = require("../components/count");
var GroupState = require("../mixins/groupState");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");

var GroupTagValues = React.createClass({
  mixins: [GroupState, Router.State],

  getInitialState() {
    return {
      tagKey: null,
      tagValueList: null,
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var params = this.getParams();

    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + this.getGroup().id + '/tags/' + this.getParams().tagKey + '/', {
      success: (data) => {
        this.setState({
          tagKey: data,
          loading: this.state.tagValueList === null
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });

    api.request('/groups/' + this.getGroup().id + '/tags/' + this.getParams().tagKey + '/values/', {
      success: (data) => {
        this.setState({
          tagValueList: data,
          loading: this.state.tagKey === null
        });
      },
      error: (error) => {
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

    var tagKey = this.state.tagKey;
    var children = this.state.tagValueList.map((tagValue, tagValueIdx) => {
      var pct = parseInt(tagValue.count / tagKey.totalValues * 100, 10);
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

    return (
      <div className="box">
        <div className="box-content with-padding">
          <div className="page-header">
            <span className="pull-right">
              <a href="">More Details</a>
            </span>
            <h5>{tagKey.name} <small><Count value={tagKey.totalValues} /></small></h5>
          </div>

          <ul className="list-unstyled">
            {children}
          </ul>
        </div>
      </div>
    );
  }
});

module.exports = GroupTagValues;
