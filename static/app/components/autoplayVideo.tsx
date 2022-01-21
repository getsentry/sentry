import * as React from 'react';

/**
 * Wrapper for autoplaying video.
 *
 * Because of react limitations and browser controls we need to
 * use refs.
 *
 * Note, video needs `muted` for `autoplay` to work on Chrome
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 */
function AutoplayVideo(props: React.VideoHTMLAttributes<HTMLVideoElement>) {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current) {
      // Set muted as more browsers allow autoplay with muted video.
      // We can't use the muted prop because of a react bug.
      // https://github.com/facebook/react/issues/10389
      // So we need to set the muted property then trigger play.
      videoRef.current.muted = true;

      // non-chromium Edge and jsdom don't return a promise.
      videoRef.current.play()?.catch(() => {
        // Do nothing. Interrupting this playback is fine.
      });
    }
  }, []);

  return (
    <video ref={videoRef} playsInline disablePictureInPicture loop {...props}>
      <source src={props.src} type="video/mp4" />
    </video>
  );
}

export {AutoplayVideo};
