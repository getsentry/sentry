import styled from '@emotion/styled';

import {ExploreSchemaHintsSection} from 'sentry/views/explore/components/styles';

export function ExpandingSchemaHintsSection({children}: React.PropsWithChildren) {
  return (
    <ExpandingContainer>
      <ExploreSchemaHintsSection>{children}</ExploreSchemaHintsSection>
    </ExpandingContainer>
  );
}

const ExpandingContainer = styled('div')`
  height: ${p => p.theme.space.sm};
  /* stylelint-disable-next-line property-no-unknown */
  interpolate-size: allow-keywords;
  overflow: hidden;
  transition:
    300ms height 200ms,
    300ms padding 200ms;
  width: 100%;

  *:hover > &,
  *:focus > &,
  &:focus-within {
    height: auto;
    padding-bottom: ${p => p.theme.space.lg};
    transition-delay: 100ms;
  }
`;
