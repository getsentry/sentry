import styled from '@emotion/styled';

import SeerIllustration from 'sentry-images/spot/seer-onboarding.png';

import {Flex} from '@sentry/scraps/layout';

export function NewWelcomeSeerExtra() {
  return (
    <SeerIllustrationWrapper>
      <img src={SeerIllustration} alt="" />
    </SeerIllustrationWrapper>
  );
}

const SeerIllustrationWrapper = styled(Flex)`
  position: absolute;
  right: 0;
  top: ${p => p.theme.space.xl};
  bottom: ${p => p.theme.space.xl};
  transform: translateX(45%);

  img {
    object-fit: contain;
  }

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: none;
  }
`;
