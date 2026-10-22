import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import onboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export function FeatureFlagCTAContent({
  handleSetupButtonClick,
}: {
  handleSetupButtonClick: (e: any) => void;
}) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();

  useEffect(() => {
    trackAnalytics('flags.cta_rendered', {
      organization,
      surface: analyticsArea,
    });
  }, [organization, analyticsArea]);

  return (
    <Fragment>
      <Stack justify="center" padding="xl">
        <BannerTitle>{t('Set Up Feature Flags')}</BannerTitle>
        <Container marginBottom="lg" maxWidth="340px">
          {t(
            'Want to know which feature flags were associated with this issue? Set up your feature flag integration.'
          )}
        </Container>
        <Flex gap="md">
          <Button onClick={handleSetupButtonClick} variant="primary">
            {t('Set Up Now')}
          </Button>
          <LinkButton
            variant="secondary"
            href="https://docs.sentry.io/product/explore/feature-flags/"
            external
            onClick={() => {
              trackAnalytics('flags.cta_read_more_clicked', {
                organization,
                surface: analyticsArea,
              });
            }}
          >
            {t('Read More')}
          </LinkButton>
        </Flex>
      </Stack>
      <Container display={{zero: 'none', xs: 'block'}}>
        {containerProps => (
          <BannerIllustration {...containerProps} src={onboardingInstall} alt="" />
        )}
      </Container>
    </Fragment>
  );
}

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
  margin-bottom: ${p => p.theme.space.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const BannerIllustration = styled('img')`
  object-fit: contain;
  max-width: 30%;
  min-width: 150px;
  padding-inline: ${p => p.theme.space.xl};
  padding-top: ${p => p.theme.space.xl};
  align-self: flex-end;
`;

export const BannerWrapper = styled(Container)`
  background: linear-gradient(
    90deg,
    color-mix(in srgb, ${p => p.theme.tokens.background.secondary} 0%, transparent) 0%,
    ${p => p.theme.tokens.background.secondary} 70%,
    ${p => p.theme.tokens.background.secondary} 100%
  );
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
`;
