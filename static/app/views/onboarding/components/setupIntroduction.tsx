import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {PlatformIcon} from 'platformicons';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {PlatformKey} from 'sentry/types/platform';
import {ONBOARDING_ENTER} from 'sentry/views/onboarding/animations';

import {OnboardingStepHeading} from './onboardingStepHeading';

type Props = {
  description: React.ReactNode;
  platform: PlatformKey;
  stepHeaderText: string;
};

export function SetupIntroduction({stepHeaderText, platform, description}: Props) {
  return (
    <TitleContainer>
      <Stack gap="sm" minWidth="0">
        <OnboardingStepHeading>{stepHeaderText}</OnboardingStepHeading>
        <motion.div {...ONBOARDING_ENTER}>
          <Text variant="muted">{description}</Text>
        </motion.div>
      </Stack>
      <IconWrapper {...ONBOARDING_ENTER}>
        <PlatformIcon size={48} format="lg" platform={platform} />
      </IconWrapper>
    </TitleContainer>
  );
}

const TitleContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};

  ${OnboardingStepHeading} {
    margin-bottom: 0;
    min-width: 0;
  }
`;

const IconWrapper = styled(motion.div)`
  margin-left: auto;
  flex-shrink: 0;
`;
