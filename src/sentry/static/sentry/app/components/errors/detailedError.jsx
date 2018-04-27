import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import Button from 'app/components/buttons/button';

class DetailedError extends React.Component {
  static propTypes = {
    className: PropTypes.string,
    /* Retry callback */
    onRetry: PropTypes.func,
    /* Error heading */
    heading: PropTypes.string.isRequired,
    /* Detailed error explanation */
    message: PropTypes.node,
    /* Hide support links in footer of error message */
    hideSupportLinks: PropTypes.bool,
  };

  static defaultProps = {
    hideSupportLinks: false,
  };

  componentDidMount() {
    // window.Raven.lastEventId() may not be immediatly true, so double-check after raven has time to send an error
    setTimeout(() => {
      this.forceUpdate();
    }, 100);
  }

  openFeedback(e) {
    e.preventDefault();
    if (window.Raven) {
      window.Raven.lastEventId() && window.Raven.showReportDialog();
    }
  }

  render() {
    const {className, heading, message, onRetry, hideSupportLinks} = this.props;
    const cx = classNames('detailed-error', className);

    const showFooter = !!onRetry || !hideSupportLinks;

    return (
      <div className={cx}>
        <div className="detailed-error-icon">
          <InlineSvg src="icon-circle-exclamation" />
        </div>
        <div className="detailed-error-content">
          <h4>{heading}</h4>

          <p className="detailed-error-content-body">{message}</p>

          {showFooter && (
            <div className="detailed-error-content-footer">
              <div>
                {onRetry && (
                  <a onClick={onRetry} className="btn btn-default">
                    {t('Retry')}
                  </a>
                )}
              </div>

              {!hideSupportLinks && (
                <div className="detailed-error-support-links">
                  {window.Raven &&
                    window.Raven.lastEventId() && (
                      <Button priority="link" onClick={this.openFeedback}>
                        {t('Fill out a report')}
                      </Button>
                    )}
                  <a href="https://status.sentry.io/">{t('Service status')}</a>

                  <a href="https://sentry.io/support/">{t('Contact support')}</a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default DetailedError;
