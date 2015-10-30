import React from 'react';
import utils from '../utils';

const Pagination = React.createClass({
  propTypes: {
    onPage: React.PropTypes.func.isRequired,
    pageLinks: React.PropTypes.string.isRequired,
  },

  onPage(cursor) {
    this.props.onPage(cursor);
  },

  render(){
    if (!this.props.pageLinks) {
      return null;
    }

    let links = utils.parseLinkHeader(this.props.pageLinks);

    let previousPageClassName = 'btn btn-default btn-lg prev';
    if (links.previous.results === false) {
      previousPageClassName += ' disabled';
    }

    let nextPageClassName = 'btn btn-default btn-lg next';
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

export default Pagination;
