import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import TestPreOnboardingPage from 'sentry/views/codecov/tests/preOnboarding';

export default function TestsOnboardingPage() {
  return (
    <LayoutGap>
      <TestPreOnboardingPage />
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
