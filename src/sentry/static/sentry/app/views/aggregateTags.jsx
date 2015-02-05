/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../api");
var PropTypes = require("../proptypes");

var AggregateTags = React.createClass({
  mixins: [Router.State],

  propTypes: {
    aggregate: PropTypes.Aggregate.isRequired
  },

  getInitialState() {
    return {
      tagList: null,
      loading: true
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var params = this.getParams();

    this.setState({loading: true});

    api.request('/groups/' + params.aggregateId + '/tags/', {
      success: (data) => {
        this.setState({tagList: data});
      },
      error: () => {
        // TODO(dcramer):
      },
      complete: () => {
        this.setState({loading: false});
      }
    });
  },


  render() {
    var children = [];

    if (this.state.tagList) {
      children = this.state.tagList.map((tag) => {
        return (
          <li>{tag.name}</li>
        );
      });
    }

    return (
      <div>
        Tags
        <ul>
          {children}
        </ul>
      </div>
    );
  }
});

module.exports = AggregateTags;
