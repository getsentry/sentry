/*** @jsx React.DOM */
var React = require("react");
var $ = require("jquery");

var utils = require("../utils");

var StreamPagination = React.createClass({
  propTypes: {
    aggList: React.PropTypes.array.isRequired,
    pageLinks: React.PropTypes.string.isRequired
  },

  render: function(){
    if (this.props.aggList.length === 0) {
      return <div />;
    }

    var links = utils.parseLinkHeader(this.props.pageLinks);

    var previousPageClassName = 'btn btn-default btn-lg prev';
    if (links.previous === '') {
      previousPageClassName += ' disabled';
    }

    var nextPageClassName = 'btn btn-default btn-lg next';
    if (links.next === '') {
      nextPageClassName += ' disabled';
    }

    return (
      <div className="stream-pagination">
        <div className="btn-group pull-right">
          <a className={previousPageClassName}
             disabled={links.previous === ''}
             href={links.previous}>
            <span title="Previous" className="icon-arrow-left"></span>
          </a>
          <a className={nextPageClassName}
             disabled={links.next === ''}
             href={links.next}>
            <span title="Next" className="icon-arrow-right"></span>
          </a>
        </div>
      </div>
    );
  }
});

module.exports = StreamPagination;
