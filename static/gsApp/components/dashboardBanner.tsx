import {css as emotionCss} from '@emotion/react';
import styled from '@emotion/styled';
import DashLeft from 'getsentry-images/dashboards-banner-left.svg';
import DashRight from 'getsentry-images/dashboards-banner-right.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';

import {Banner} from 'sentry/components/banner';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {UpsellButton} from 'getsentry/components/upsellButton';

type Props = {
  organization: Organization;
};

export function DashboardBanner({organization}: Props) {
  // No upsell if the user can edit dashboards
  if (organization.features.includes('organizations:dashboards-edit')) {
    return null;
  }

  return (
    <StyledBanner
      title={t('Customize Dashboards')}
      subtitle={t('Build your own widgets and manage multiple dashboards')}
      backgroundComponent={
        <BannerBackground
          display={{zero: 'none', xl: 'block'}}
          height="95%"
          width="95%"
        />
      }
      dismissKey="dashboards"
    >
      <UpsellButton source="custom-dashboards" variant="primary" />
      <LinkButton href="https://docs.sentry.io/product/dashboards/" external>
        {t('Read the docs')}
      </LinkButton>
    </StyledBanner>
  );
}

const StyledBanner = styled(Banner)`
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
  color: ${p => p.theme.tokens.content.primary};
`;

const BannerBackground = styled(Container)(emotionCss`
  background-image: url(${DashLeft}), url(${DashRight});
  background-position:
    left center,
    right center;
  background-repeat: no-repeat, no-repeat;
  background-size:
    20% 100%,
    20% 100%;
`);
