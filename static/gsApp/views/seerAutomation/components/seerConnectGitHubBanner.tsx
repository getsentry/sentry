import {useCallback} from 'react';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import seerConfigMainBg from 'sentry-images/spot/seer-config-main-bg.svg';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useInvertedTheme} from 'sentry/utils/theme/useInvertedTheme';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';

import {GithubButton} from 'getsentry/views/seerAutomation/onboarding/githubButton';
import {SeerOnboardingProvider} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';

export default function SeerConnectGitHubBanner() {
  const theme = useInvertedTheme();

  const {data, isFetched, isError} = useSeerOnboardingCheck();

  const handleAddIntegration = useCallback(() => {
    window.location.reload();
  }, []);

  if (!isFetched || isError || data?.hasSupportedScmIntegration) {
    return null;
  }

  return (
    <Container border="primary" radius="lg" overflow="hidden">
      <ThemeProvider theme={theme}>
        <Container background="primary">
          <Grid columns="5fr 2fr">
            <ImageContainer />
            <Stack gap="lg" padding="2xl">
              <Heading as="h3">{t('Connect to GitHub')}</Heading>
              <Text>{t('Enable Seer AI Code Reviews in your GitHub repositories.')}</Text>

              <Flex paddingTop="lg">
                <SeerOnboardingProvider>
                  <GithubButton
                    onAddIntegration={handleAddIntegration}
                    analyticsView="seer_onboarding_github"
                  />
                </SeerOnboardingProvider>
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
