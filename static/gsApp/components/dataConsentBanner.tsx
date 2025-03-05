import {useMemo} from 'react';
import styled from '@emotion/styled';

import dataConsentImage from 'sentry-images/spot/add-integration-provider.svg';
import bannerStars from 'sentry-images/spot/ai-suggestion-banner-stars.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import getOrganizationAge from 'sentry/utils/getOrganizationAge';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {openDataConsentModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

const titles = {
  issues: t('Help make Sentry less noisy and more precise'),
  alerts: t('Help make Sentry alerts less noisy and more actionable'),
  grouping: t('Help Sentry improve grouping quality'),
};

function DataConsentBanner({
  source,
  subscription,
}: {
  source: string;
  subscription: Subscription;
}) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const bannerTitle = titles[source];
  const organization = useOrganization();
  const {projects} = useProjects();
  const hasBillingAccess = organization.access.includes('org:billing');

  const hasOrgSentFirstEvent = useMemo(() => {
    return projects.map(project => project.firstEvent).some(Boolean);
  }, [projects]);

  const {isLoading, isError, isPromptDismissed, dismissPrompt} = usePrompt({
    feature: 'data_consent_banner',
    organization,
  });

  const organizationAge = getOrganizationAge(organization);

  const hideDataConsentBanner =
    isLoading ||
    isError ||
    isPromptDismissed ||
    organization.aggregatedDataConsent ||
    !hasBillingAccess ||
    (defined(subscription.msaUpdatedForDataConsent)
      ? !subscription.msaUpdatedForDataConsent
      : false) ||
    organizationAge < 60 ||
    organizationAge > 120 ||
    !hasOrgSentFirstEvent;

  if (hideDataConsentBanner) {
    return null;
  }

  return (
    <DataConsentBannerWrapper>
      <div>
        <DataConsentBannerTitle>{bannerTitle}</DataConsentBannerTitle>
        <Button
          analyticsEventKey="data_consent_banner.learn_more"
          analyticsEventName="Data Consent Banner: Learn More"
          analyticsParams={{source}}
          size="sm"
          onClick={() => openDataConsentModal()}
        >
          {t('Learn More')}
        </Button>
      </div>
      <DismissButton
        analyticsEventKey="data_consent_banner.dismissed"
        analyticsEventName="Data Consent Banner: Dismissed"
        analyticsParams={{source}}
        size="zero"
        borderless
        icon={<IconClose size="xs" />}
        aria-label={t('Dismiss')}
        onClick={() => dismissPrompt()}
      />
      <StarContainer>
        <LeftStars src={bannerStars} />
      </StarContainer>
      <IllustrationContainer>
        <RightStars src={bannerStars} />
        <Sentaur src={dataConsentImage} />
      </IllustrationContainer>
    </DataConsentBannerWrapper>
  );
}

export default withSubscription(DataConsentBanner, {noLoader: true});

const DataConsentBannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  margin-bottom: ${space(2)};
  grid-column: 1 / -1;
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
`;

const DataConsentBannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: 600;
`;

const StarContainer = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: block;
    position: absolute;
    bottom: 0;
    right: 0;
    top: 0;
    width: 600px;
    overflow: hidden;
    border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  }
`;

const IllustrationContainer = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    display: block;
    position: absolute;
    bottom: 0;
    right: 0;
    top: 0;
    width: 600px;
    overflow: hidden;
    border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  }
`;

const Sentaur = styled('img')`
  height: 90px;
  position: absolute;
  bottom: -3px;
  right: 300px;
  z-index: 1;
  pointer-events: none;
`;

const RightStars = styled('img')`
  pointer-events: none;
  position: absolute;
  right: -120px;
  bottom: 10px;
  height: 110px;
`;

const LeftStars = styled('img')`
  pointer-events: none;
  position: absolute;
  right: 230px;
  bottom: 30px;
  height: 100px;
`;

const DismissButton = styled(Button)`
  position: absolute;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.subText};
  z-index: 1;
`;
