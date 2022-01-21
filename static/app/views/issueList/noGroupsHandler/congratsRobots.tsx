import styled from '@emotion/styled';

import video from 'sentry-images/spot/congrats-robots.mp4';

import {AutoplayVideo} from 'sentry/components/autoplayVideo';
import space from 'sentry/styles/space';

/**
 * Note, video needs `muted` for `autoplay` to work on Chrome
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 */
function CongratsRobots() {
  return (
    <AnimatedScene>
      <StyledAutoplayVideo src={video} />
    </AnimatedScene>
  );
}

export default CongratsRobots;

const AnimatedScene = styled('div')`
  max-width: 800px;
`;

const StyledAutoplayVideo = styled(AutoplayVideo)`
  max-height: 320px;
  max-width: 100%;
  margin-bottom: ${space(1)};
`;
