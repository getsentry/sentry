import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import onboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {Flex, Stack} from '@sentry/scraps/layout';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeatureFlagCTAContent({
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
        <BannerDescription>
          {t(
            'Want to know which feature flags were associated with this issue? Set up your feature flag integration.'
          )}
        </BannerDescription>
        <Flex gap="md">
          <Button onClick={handleSetupButtonClick} priority="primary">
            {t('Set Up Now')}
          </Button>
          <LinkButton
            priority="default"
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
      <BannerIllustration src={onboardingInstall} alt="" />
    </Fragment>
  );
}

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BannerDescription = styled('div')`
  margin-bottom: ${space(1.5)};
  max-width: 340px;
`;

const BannerIllustration = styled('img')`
  object-fit: contain;
  max-width: 30%;
  min-width: 150px;
  padding-inline: ${space(2)};
  padding-top: ${space(2)};
  align-self: flex-end;
`;

export const BannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: linear-gradient(
    90deg,
    color-mix(in srgb, ${p => p.theme.tokens.background.secondary} 0%, transparent) 0%,
    ${p => p.theme.tokens.background.secondary} 70%,
    ${p => p.theme.tokens.background.secondary} 100%
  );
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${space(1)};

  container-name: bannerWrapper;
  container-type: inline-size;

  @container bannerWrapper (max-width: 400px) {
    img {
      display: none;
    }
  }
`;
