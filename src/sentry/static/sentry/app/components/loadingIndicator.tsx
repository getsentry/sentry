import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {withProfiler} from '@sentry/react';

import AutoplayVideo from 'app/components/autoplayVideo';

import spinnerVideo from '../../images/sentry-loader.mp4';

type Props = {
  overlay?: boolean;
  dark?: boolean;
  mini?: boolean;
  triangle?: boolean;
  finished?: boolean;
  relative?: boolean;
  hideMessage?: boolean;
  hideSpinner?: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

function LoadingIndicator(props: Props) {
  const {
    hideMessage,
    mini,
    triangle,
    overlay,
    dark,
    children,
    finished,
    className,
    style,
    relative,
    size,
    hideSpinner,
  } = props;
  const cx = classNames(className, {
    overlay,
    dark,
    loading: true,
    mini,
    triangle,
  });

  const loadingCx = classNames({
    relative,
    'loading-indicator': true,
    'load-complete': finished,
  });

  let loadingStyle = {};
  if (size) {
    loadingStyle = {
      width: size,
      height: size,
    };
  }

  return (
    <div className={cx} style={style}>
      {!hideSpinner && (
        <div className={loadingCx} style={loadingStyle}>
          {triangle && <AutoplayVideo src={spinnerVideo} height="150" />}
          {finished ? <div className="checkmark draw" style={style} /> : null}
        </div>
      )}

      {!hideMessage && <div className="loading-message">{children}</div>}
    </div>
  );
}
LoadingIndicator.propTypes = {
  overlay: PropTypes.bool,
  dark: PropTypes.bool,
  mini: PropTypes.bool,
  triangle: PropTypes.bool,
  finished: PropTypes.bool,
  relative: PropTypes.bool,
  hideMessage: PropTypes.bool,
  size: PropTypes.number,
  hideSpinner: PropTypes.bool,
};

export default withProfiler(LoadingIndicator, {
  includeUpdates: false,
});
