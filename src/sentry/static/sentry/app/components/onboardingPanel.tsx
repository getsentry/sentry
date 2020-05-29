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
        <IllustrationContainer>{image}</IllustrationContainer>
        <StyledBox>{children}</StyledBox>
      </Container>
    </Panel>
  );
}

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  min-height: 450px;
  padding: ${space(1)} ${space(4)};
`;

const StyledBox = styled('div')`
  flex: 1;
  padding: ${space(3)};
`;

const IllustrationContainer = styled(StyledBox)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default OnboardingPanel;
