import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function CoverageOnboardingPage() {
  return (
    <LayoutGap>
      <p>Coverage Onboarding</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
