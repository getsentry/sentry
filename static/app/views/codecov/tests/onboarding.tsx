import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function TestsOnboardingPage() {
  return (
    <LayoutGap>
      <p>Test Analytics Onboarding</p>
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
