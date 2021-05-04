import * as React from 'react';

type Props = React.HTMLProps<HTMLVideoElement>;

/**
 * Wrapper for autoplaying video.
 *
 * Because of react limitations and browser controls we need to
 * use refs.
 *
 * Note, video needs `muted` for `autoplay` to work on Chrome
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 */
class AutoplayVideo extends React.Component<Props> {
  componentDidMount() {
    if (this.videoRef.current) {
      // Set muted as more browsers allow autoplay with muted video.
      // We can't use the muted prop because of a react bug.
      // https://github.com/facebook/react/issues/10389
      // So we need to set the muted property then trigger play.
      this.videoRef.current.muted = true;
      const playPromise = this.videoRef.current.play();

      // non-chromium Edge and jsdom don't return a promise.
      playPromise?.catch(() => {
        // Do nothing. Interrupting this playback is fine.
      });
    }
  }
  private videoRef = React.createRef<HTMLVideoElement>();

  render() {
    const {className, src, ...props} = this.props;

    return (
      <video
        className={className}
        ref={this.videoRef}
        playsInline
        disablePictureInPicture
        loop
        {...props}
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }
}

export default AutoplayVideo;
