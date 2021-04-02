import React from 'react';
import {withProfiler} from '@sentry/react';
import classNames from 'classnames';

import sentryLoader from 'sentry-images/sentry-loader.svg';

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

function renderLogoSpinner() {
  return <img src={sentryLoader} />;
}

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
          {triangle && renderLogoSpinner()}
          {finished ? <div className="checkmark draw" style={style} /> : null}
        </div>
      )}
      {!hideMessage && <div className="loading-message">{children}</div>}
    </div>
  );
}

export default withProfiler(LoadingIndicator, {
  includeUpdates: false,
});
