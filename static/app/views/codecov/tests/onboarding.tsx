import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import TestPreOnboardingPage from 'sentry/views/codecov/tests/preOnboarding';

export default function TestsOnboardingPage() {
  const organization = useOrganization();

  return (
    <LayoutGap>
      <p>Test Analytics Onboarding</p>
      <TestPreOnboardingPage organization={organization} />
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
