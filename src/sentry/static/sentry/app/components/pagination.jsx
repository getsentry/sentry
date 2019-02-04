import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import utils from 'app/utils';
import {t} from 'app/locale';

export default class Pagination extends React.Component {
  static propTypes = {
    pageLinks: PropTypes.string,
    to: PropTypes.string,
    onCursor: PropTypes.func,
    className: PropTypes.string,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  static defaultProps = {
    onCursor: (cursor, path, query) => {
      query.cursor = cursor;
      browserHistory.push({
        pathname: path,
        query,
      });
    },
    className: 'stream-pagination',
  };

  render() {
    const {className, onCursor, pageLinks} = this.props;
    if (!pageLinks) {
      return null;
    }

    const location = this.context.location;
    const path = this.props.to || location.pathname;
    const query = location.query;

    const links = utils.parseLinkHeader(pageLinks);

    let previousPageClassName = 'btn btn-default btn-lg prev';
    if (links.previous.results === false) {
      previousPageClassName += ' disabled';
    }

    let nextPageClassName = 'btn btn-default btn-lg next';
    if (links.next.results === false) {
      nextPageClassName += ' disabled';
    }

    return (
      <div className={'clearfix' + (className ? ` ${className}` : '')}>
        <div className="btn-group pull-right">
          <a
            onClick={() => {
              onCursor(links.previous.cursor, path, query);
            }}
            className={previousPageClassName}
            disabled={links.previous.results === false}
          >
            <span title={t('Previous')} className="icon-arrow-left" />
          </a>
          <a
            onClick={() => {
              onCursor(links.next.cursor, path, query);
            }}
            className={nextPageClassName}
            disabled={links.next.results === false}
          >
            <span title={t('Next')} className="icon-arrow-right" />
          </a>
        </div>
      </div>
    );
  }
}
