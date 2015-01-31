/*** @jsx React.DOM */
var React = require("react");

var utils = require("../../utils");

var StreamPagination = React.createClass({
  propTypes: {
    aggList: React.PropTypes.instanceOf(Array).isRequired,
    pageLinks: React.PropTypes.string.isRequired
  },

  render: function(){
    if (!this.props.pageLinks || this.props.aggList.length === 0) {
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
             href={links.previous.href}>
            <span title="Previous" className="icon-arrow-left"></span>
          </a>
          <a className={nextPageClassName}
             disabled={links.next.results === false}
             href={links.next.href}>
            <span title="Next" className="icon-arrow-right"></span>
          </a>
        </div>
      </div>
    );
  }
});

module.exports = StreamPagination;
