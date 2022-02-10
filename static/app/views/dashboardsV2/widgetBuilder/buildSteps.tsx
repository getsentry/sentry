import * as React from 'react';
import styled from '@emotion/styled';

import List from 'sentry/components/list';
import space from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
};

function BuildSteps({children}: Props) {
  return <StyledList symbol="colored-numeric">{children}</StyledList>;
}

export default BuildSteps;

const StyledList = styled(List)`
  display: grid;
  gap: ${space(4)};
  max-width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    max-width: 50%;
  }
`;
