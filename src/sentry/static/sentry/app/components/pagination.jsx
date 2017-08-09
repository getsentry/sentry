import React from 'react';
import utils from '../utils';
import {browserHistory} from 'react-router';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    pageLinks: React.PropTypes.string,
    to: React.PropTypes.string,
    onCursor: React.PropTypes.func
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  getDefaultProps() {
    return {
      onCursor: (cursor, path, query) => {
        browserHistory.pushState(null, path, {
          ...query,
          cursor: cursor
        });
      }
    };
  },

  render() {
    let {onCursor, pageLinks} = this.props;
    if (!pageLinks) {
      return null;
    }

    let location = this.context.location;
    let path = this.props.to || location.pathname;
    let query = location.query;

    let links = utils.parseLinkHeader(pageLinks);

    let previousPageClassName = 'btn btn-default btn-lg prev';
    if (links.previous.results === false) {
      previousPageClassName += ' disabled';
    }

    let nextPageClassName = 'btn btn-default btn-lg next';
    if (links.next.results === false) {
      nextPageClassName += ' disabled';
    }

    return (
      <div className="stream-pagination clearfix">
        <div className="btn-group pull-right">
          <a
            onClick={() => {
              onCursor(links.previous.cursor, path, query);
            }}
            className={previousPageClassName}
            disabled={links.previous.results === false}>
            <span title={t('Previous')} className="icon-arrow-left" />
          </a>
          <a
            onClick={() => {
              onCursor(links.next.cursor, path, query);
            }}
            className={nextPageClassName}
            disabled={links.next.results === false}>
            <span title={t('Next')} className="icon-arrow-right" />
          </a>
        </div>
      </div>
    );
  }
});
