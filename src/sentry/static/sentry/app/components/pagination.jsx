import React from 'react';
import utils from '../utils';
import {Link} from 'react-router';
import {t} from '../locale';

const Pagination = React.createClass({
  propTypes: {
    pageLinks: React.PropTypes.string,
    to: React.PropTypes.string
  },

  contextTypes: {
    location: React.PropTypes.object
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

    let location = this.context.location;
    return (
      <div className="stream-pagination">
        <div className="btn-group pull-right">
          <Link
            to={this.props.to || location.pathname}
            query={{...location.query, cursor: links.previous.cursor}}
            className={previousPageClassName}
            disabled={links.previous.results === false}>
            <span title={t('Previous')} className="icon-arrow-left"></span>
          </Link>
          <Link to={this.props.to || location.pathname}
            query={{...location.query, cursor: links.next.cursor}}
            className={nextPageClassName}
            disabled={links.next.results === false}>
            <span title={t('Next')} className="icon-arrow-right"></span>
          </Link>
        </div>
      </div>
    );
  }
});

export default Pagination;
