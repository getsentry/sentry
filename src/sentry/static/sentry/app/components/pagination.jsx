import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import utils from 'app/utils';
import {t} from 'app/locale';

export default class Pagination extends React.Component {
  static propTypes = {
    // If this is set, reset `cursor` when clicking "previous" if the target cursor is
    // equal to this prop. This is used as kind of a hack for the situation where you browse "next",
    // then "previous" so you are back to the "initial" result set, but due to snuba reasons we can't
    // be certain if there are new "previous" events on the initial page
    resetPreviousCursor: PropTypes.string,
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
    const {className, onCursor, pageLinks, resetPreviousCursor} = this.props;
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
              let cursor = links.previous.cursor;

              // Chop off `cursor` if we are trying to click "previous" back to the initial result set,
              // instead of maintaining a cursor to guarantee consistency, if we navigate back to the "first" page,
              // reset the cursor so that we have the newest items.
              if (resetPreviousCursor) {
                const [initialTs] = resetPreviousCursor.split(':');
                const [previousTs] = links.previous.cursor.split(':');

                if (previousTs === initialTs) {
                  cursor = undefined;
                }
              }
              onCursor(cursor, path, query);
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
