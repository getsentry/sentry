import React, {PropTypes} from 'react';
import classNames from 'classnames';

import {t} from '../../locale';
import IconCircleExclamation from '../../icons/icon-circle-exclamation';

const DetailedError = React.createClass({
  propTypes: {
    className: PropTypes.string,
    /* Retry callback */
    onRetry: PropTypes.func,
    /* Error heading */
    heading: PropTypes.string.isRequired,
    /* Detailed error explanation */
    message: PropTypes.node,
    /* Hide support links in footer of error message */
    hideSupportLinks: PropTypes.bool
  },

  getDefaultProps() {
    return {
      hideSupportLinks: false
    };
  },

  render() {
    const {className, heading, message, onRetry, hideSupportLinks} = this.props;
    const cx = classNames('detailed-error', className);

    const showFooter = !!onRetry || !hideSupportLinks;

    return (
      <div className={cx}>
        <div className="detailed-error-icon">
          <IconCircleExclamation />
        </div>
        <div className="detailed-error-content">
          <h4>
            {heading}
          </h4>

          <div className="detailed-error-content-body">
            {message}
          </div>

          {showFooter &&
            <div className="detailed-error-content-footer">
              <div>
                {onRetry &&
                  <a onClick={onRetry} className="btn btn-default">
                    {t('Retry')}
                  </a>}
              </div>

              {!hideSupportLinks &&
                <div className="detailed-error-support-links">
                  <a href="https://status.sentry.io/">
                    Service status
                  </a>

                  <a href="https://sentry.io/support/">
                    Contact support
                  </a>
                </div>}
            </div>}
        </div>
      </div>
    );
  }
});

export default DetailedError;
