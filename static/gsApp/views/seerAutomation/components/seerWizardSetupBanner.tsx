import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import seerConfigMainBg from 'sentry-images/spot/seer-config-main-bg.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useInvertedTheme} from 'sentry/utils/theme/useInvertedTheme';
import useOrganization from 'sentry/utils/useOrganization';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';

export default function SeerWizardSetupBanner() {
  const organization = useOrganization();
  const theme = useInvertedTheme();

  const {data, isFetched, isError} = useSeerOnboardingCheck();

  if (!isFetched || isError) {
    return null;
  }

  if (data?.isSeerConfigured && !data?.needsConfigReminder) {
    return null;
  }

  return (
    <Container border="primary" radius="lg" overflow="hidden">
      <ThemeProvider theme={theme}>
        <Container background="primary">
          <Grid columns="5fr 2fr">
            <ImageContainer />
            <Stack gap="lg" padding="2xl">
              <Heading as="h3">{t('Meet Seer')}</Heading>
              <Text>
                {t('Get the most out of Sentry; use our wizard to set up Seer.')}
              </Text>

              <Flex paddingTop="lg">
                <LinkButton
                  to={`/settings/${organization.slug}/seer/onboarding/`}
                  priority="primary"
                  icon={<IconSeer />}
                >
                  {t('Set Up Seer')}
                </LinkButton>
              </Flex>
            </Stack>
          </Grid>
        </Container>
      </ThemeProvider>
    </Container>
  );
}

const ImageContainer = styled('div')`
  background-image: url(${seerConfigMainBg});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
`;
