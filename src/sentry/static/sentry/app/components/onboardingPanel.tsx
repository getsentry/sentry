import React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
import space from 'app/styles/space';

type Props = React.PropsWithChildren<{
  image: React.ReactNode;
  className?: string;
}>;

function OnboardingPanel({className, image, children}: Props) {
  return (
    <Panel className={className}>
      <Container>
        <IlloBox>{image}</IlloBox>
        <StyledBox>{children}</StyledBox>
      </Container>
    </Panel>
  );
}

const Container = styled('div')`
  padding: ${space(3)};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    min-height: 300px;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    min-height: 350px;
  }
`;

const StyledBox = styled('div')`
  z-index: 1;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    flex: 2;
  }
`;

const IlloBox = styled(StyledBox)`
  position: relative;
  min-height: 100px;
  max-width: 300px;
  margin: ${space(2)} auto;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    flex: 1;
    margin: ${space(3)};
    max-width: auto;
  }
`;

export default OnboardingPanel;
