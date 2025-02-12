import styled from '@emotion/styled';
import DashLeft from 'getsentry-images/dashboards-banner-left.svg';
import DashRight from 'getsentry-images/dashboards-banner-right.svg';

import Banner from 'sentry/components/banner';
import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import UpsellButton from 'getsentry/components/upsellButton';

type Props = {
  organization: Organization;
};

function DashboardBanner({organization}: Props) {
  // No upsell if the user can edit dashboards
  if (organization.features.includes('organizations:dashboards-edit')) {
    return null;
  }

  return (
    <StyledBanner
      title={t('Customize Dashboards')}
      subtitle={t('Build your own widgets and manage multiple dashboards')}
      backgroundComponent={<DashboardBackground />}
      dismissKey="dashboards"
    >
      <UpsellButton source="custom-dashboards" priority="primary" />
      <LinkButton href="https://docs.sentry.io/product/dashboards/" external>
        {t('Read the docs')}
      </LinkButton>
    </StyledBanner>
  );
}

const StyledBanner = styled(Banner)`
  background-color: ${p => p.theme.purple100};
  color: ${p => p.theme.textColor};
`;

const DashboardBackground = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    background-image: url(${DashLeft}), url(${DashRight});
    background-position:
      left center,
      right center;
    background-repeat: no-repeat, no-repeat;
    background-size:
      20% 100%,
      20% 100%;
    height: 95%;
    width: 95%;
  }
`;

export default DashboardBanner;
