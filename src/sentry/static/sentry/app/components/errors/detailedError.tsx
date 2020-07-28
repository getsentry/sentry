import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import {IconFlag} from 'app/icons';
import Button from 'app/components/button';

type DefaultProps = {
  /**
   * Hide support links in footer of error message
   */
  hideSupportLinks: boolean;
};

type Props = DefaultProps & {
  className?: string;
  /**
   * Error heading
   */
  heading: React.ReactNode;
  /**
   * Detailed error explanation
   */
  message?: React.ReactNode;
  /**
   * Retry callback
   */
  onRetry?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

function openFeedback(e: React.MouseEvent) {
  e.preventDefault();
  Sentry.showReportDialog();
}

class DetailedError extends React.Component<Props> {
  static propTypes = {
    className: PropTypes.string,
    onRetry: PropTypes.func,
    heading: PropTypes.string.isRequired,
    message: PropTypes.node,
    hideSupportLinks: PropTypes.bool,
  };

  static defaultProps: DefaultProps = {
    hideSupportLinks: false,
  };

  componentDidMount() {
    // XXX(epurkhiser): Why is this here?
    setTimeout(() => this.forceUpdate(), 100);
  }

  render() {
    const {className, heading, message, onRetry, hideSupportLinks} = this.props;
    const cx = classNames('detailed-error', className);

    const showFooter = !!onRetry || !hideSupportLinks;

    return (
      <div className={cx}>
        <div className="detailed-error-icon">
          <IconFlag size="lg" />
        </div>
        <div className="detailed-error-content">
          <h4>{heading}</h4>

          <div className="detailed-error-content-body">{message}</div>

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
                  {Sentry.lastEventId() && (
                    <Button priority="link" onClick={openFeedback}>
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
