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
              <a className="tag-bar" href="">
                <span className="tag-bar-background" style={{width: '10%'}}></span>
                <span className="tag-bar-label">{tagValue.value}</span>
                <span className="tag-bar-count"><Count value={tagValue.count} /></span>
              </a>
            </li>
          );
        });

        return (
          <div className="col-md-6" key={tagIdx}>
            <div className="box">
              <div className="box-content with-padding">
                <div className="page-header">
                  <span className="pull-right">
                    <a href="">More Details</a>
                  </span>
                  <h5>{tag.name} <small><Count value={tag.totalValues} /></small></h5>
                </div>

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
      <div className="row">
        {children}
      </div>
    );
  }
});

module.exports = AggregateTags;
