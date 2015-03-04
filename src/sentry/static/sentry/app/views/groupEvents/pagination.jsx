/*** @jsx React.DOM */
var React = require("react");
var Router = require("react-router");

var utils = require("../../utils");

var GroupEventsPagination = React.createClass({
  mixins: [Router.Navigation, Router.State],

  propTypes: {
    pageLinks: React.PropTypes.string.isRequired,
  },

  onPage(cursor) {
    var queryParams = this.getQuery();
    queryParams.cursor = cursor;

    this.transitionTo('groupEvents', this.getParams(), queryParams);
  },

  render(){
    if (!this.props.pageLinks) {
      return <div />;
    }

    var links = utils.parseLinkHeader(this.props.pageLinks);

    var previousPageClassName = 'btn btn-default btn-lg prev';
    if (links.previous.results === false) {
      previousPageClassName += ' disabled';
    }

    var nextPageClassName = 'btn btn-default btn-lg next';
    if (links.next.results === false) {
      nextPageClassName += ' disabled';
    }

    return (
      <div className="stream-pagination">
        <div className="btn-group pull-right">
          <a className={previousPageClassName}
             disabled={links.previous.results === false}
             onClick={this.onPage.bind(this, links.previous.cursor)}>
            <span title="Previous" className="icon-arrow-left"></span>
          </a>
          <a className={nextPageClassName}
             disabled={links.next.results === false}
             onClick={this.onPage.bind(this, links.next.cursor)}>
            <span title="Next" className="icon-arrow-right"></span>
          </a>
        </div>
      </div>
    );
  }
});

module.exports = GroupEventsPagination;
