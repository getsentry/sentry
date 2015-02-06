/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var Count = require("../components/count");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var PropTypes = require("../proptypes");

var AggregateTags = React.createClass({
  mixins: [Router.State],

  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired
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
    var params = this.getParams();

    this.setState({loading: true});

    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + params.aggregateId + '/tags/', {
      success: (data) => {
        this.setState({
          tagList: data,
          error: false,
          loading: false
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

    var children = [];

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        var valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          return (
            <li key={tagValueIdx}>
              <a href="">
                {tagValue.value}
                <span><Count value={tagValue.count} /></span>
              </a>
            </li>
          );
        });

        return (
          <div className="span6" key={tagIdx}>
            <div className="page-header">
              <span className="pull-right">
                <a href="">More Details</a>
              </span>
              <h4>{tag.name} <small><Count value={tag.totalValues} /></small></h4>
            </div>

            <ul>
              {valueChildren}
            </ul>
          </div>
        );
      });
    }

    return (
      <div>
        {children}
      </div>
    );
  }
});

module.exports = AggregateTags;
