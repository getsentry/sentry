import React from 'react';
import classNames from 'classnames';

class SentryIcon extends React.Component {
  render() {
    let {className, ...props} = this.props;

    return <span {...props} className={classNames('icon-sentry-logo', className)} />;
  }
}

export default SentryIcon;
