import {withProfiler} from '@sentry/react';
import classNames from 'classnames';

interface LoadingIndicatorProps {
  children?: NonNullable<React.ReactNode>;
  className?: string;
  ['data-test-id']?: string;
  mini?: boolean;
  overlay?: boolean;
  relative?: boolean;
  size?: number;
  style?: React.CSSProperties;
}

function LoadingIndicator(props: LoadingIndicatorProps) {
  return (
    <div
      className={classNames('loading', props.className, {
        overlay: props.overlay,
        mini: props.mini,
      })}
      style={props.style}
      data-test-id={props['data-test-id'] ?? 'loading-indicator'}
    >
      <div
        className={classNames('loading-indicator', {
          relative: props.relative,
        })}
        style={props.size ? {width: props.size, height: props.size} : undefined}
      />
      {props.children && <div className="loading-message">{props.children}</div>}
    </div>
  );
}

export default withProfiler(LoadingIndicator, {
  includeUpdates: false,
});
