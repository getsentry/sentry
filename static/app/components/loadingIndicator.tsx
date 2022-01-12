import * as React from 'react';
import {withProfiler} from '@sentry/react';
import classNames from 'classnames';

type Props = {
  overlay?: boolean;
  dark?: boolean;
  mini?: boolean;
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
    overlay,
    dark,
    children,
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
  });

  const loadingCx = classNames({
    relative,
    'loading-indicator': true,
  });

  let loadingStyle = {};
  if (size) {
    loadingStyle = {
      width: size,
      height: size,
    };
  }

  return (
    <div className={cx} style={style} data-test-id="loading-indicator">
      {!hideSpinner && <div className={loadingCx} style={loadingStyle} />}
      {!hideMessage && <div className="loading-message">{children}</div>}
    </div>
  );
}

export default withProfiler(LoadingIndicator, {
  includeUpdates: false,
});
