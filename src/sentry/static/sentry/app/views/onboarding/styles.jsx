import styled from 'react-emotion';
import posed from 'react-pose';

import space from 'app/styles/space';

const PosedOnboardingStep = posed.div({
  start: {opacity: 0, y: 100},
  enter: {opacity: 1, y: 0},
});

export const OnboardingStep = styled(PosedOnboardingStep)`
  margin-left: -20px;
  padding-left: 18px;
  border-left: 2px solid ${p => p.theme.borderLighter};
  counter-increment: step;
  position: relative;

  &:before {
    content: counter(step);
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    left: -20px;
    background-color: ${p => p.theme.gray5};
    color: #fff;
    font-size: 1.5rem;
  }

  &:not(:last-child) {
    margin-bottom: ${space(4)};
  }
`;
