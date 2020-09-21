import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {withProfiler} from '@sentry/react';

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

class LoadingIndicator extends React.Component<Props> {
  static propTypes = {
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

  componentDidMount() {
    if (this.videoRef.current) {
      // Set muted as more browsers allow autoplay with muted video.
      // We can't use the muted prop because of a react bug.
      // https://github.com/facebook/react/issues/10389
      // So we need to set the muted property then trigger play.
      this.videoRef.current.muted = true;
      this.videoRef.current.play();
    }
  }

  private videoRef = React.createRef<HTMLVideoElement>();

  render() {
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
    } = this.props;
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
            {triangle && (
              <video
                ref={this.videoRef}
                playsInline
                disablePictureInPicture
                loop
                height="150"
              >
                <source src={spinnerVideo} type="video/mp4" />
              </video>
            )}
            {finished ? <div className="checkmark draw" style={style} /> : null}
          </div>
        )}

        {!hideMessage && <div className="loading-message">{children}</div>}
      </div>
    );
  }
}

export default withProfiler(LoadingIndicator, {
  includeUpdates: false,
});
