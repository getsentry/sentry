import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import video from 'app/../images/spot/congrats-robots.mp4';

/**
 * Note, video needs `muted` for `autoplay` to work on Chrome
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 */
const CongratsRobots = () => (
  <AnimatedScene>
    <StyledVideo autoPlay loop muted>
      <source src={video} type="video/mp4" />
    </StyledVideo>
  </AnimatedScene>
);

export default CongratsRobots;

const AnimatedScene = styled('div')`
  max-width: 800px;
`;

const StyledVideo = styled('video')`
  max-height: 320px;
  max-width: 100%;
  margin-bottom: ${space(1)};
`;
