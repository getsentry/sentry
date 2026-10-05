import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {ONBOARDING_ENTER} from 'sentry/views/onboarding/animations';

export const OnboardingStepHeading = styled(
  (props: React.ComponentProps<typeof motion.h2>) => (
    <motion.h2 {...ONBOARDING_ENTER} {...props} />
  )
)`
  position: relative;
`;
