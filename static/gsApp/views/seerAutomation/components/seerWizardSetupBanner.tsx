import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import seerConfigMainBg from 'sentry-images/spot/seer-config-main-bg.svg';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';
import {Grid} from '@sentry/scraps/layout/grid';
import {Stack} from '@sentry/scraps/layout/stack';
import {Heading} from '@sentry/scraps/text/heading';
import {Text} from '@sentry/scraps/text/text';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
// eslint-disable-next-line no-restricted-imports
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import useOrganization from 'sentry/utils/useOrganization';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';

export default function SeerWizardSetupBanner() {
  const organization = useOrganization();
  const config = useLegacyStore(ConfigStore);
  const invertedTheme = config.theme === 'dark' ? lightTheme : darkTheme;

  const {data, isFetched, isError} = useSeerOnboardingCheck();

  if (!isFetched || isError) {
    return null;
  }

  if (data?.isSeerConfigured) {
    return null;
  }

  return (
    <ThemeProvider theme={invertedTheme}>
      <Container background="primary" radius="lg">
        <Grid columns="5fr 2fr">
          <ImageContainer />
          <Stack gap="lg" padding="2xl">
            <Heading as="h3">{t('Meet Seer')}</Heading>
            <Text>{t('Get the most out of Sentry; use our wizard to set up Seer.')}</Text>

            <Flex paddingTop="lg">
              <LinkButton
                to={`/organizations/${organization.slug}/settings/seer/onboarding/`}
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
  );
}

const ImageContainer = styled('div')`
  background-image: url(${seerConfigMainBg});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: ${p => p.theme.radius.lg} 0 0 ${p => p.theme.radius.lg};
`;
