import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconBusiness} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withOrganization from 'sentry/utils/withOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getTrialDaysLeft} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  organization: Organization;
  source: string;
  subscription: Subscription;
};

function TargetedOnboardingHeader({organization, source, subscription}: Props) {
  if (!organization) {
    return null;
  }

  const trackClickNeedHelp = () =>
    trackGetsentryAnalytics('growth.onboarding_clicked_need_help', {
      organization,
      source,
    });
  const trackClickUpgrade = () => {
    trackGetsentryAnalytics('growth.onboarding_clicked_upgrade', {
      source,
      organization,
    });
  };

  // if trial is active, show info on that
  // otherwise show help button
  const cta = subscription.isTrial ? (
    <ActiveTrialWrapper
      onClick={() => openUpsellModal({organization, source: 'targeted-onboarding'})}
    >
      <ActiveTrialHeader>{t('Trial is Active')}</ActiveTrialHeader>
      <div>{tn('%s Day Left', '%s Days Left', getTrialDaysLeft(subscription) || 0)}</div>
    </ActiveTrialWrapper>
  ) : (
    <NeedHelpLink href="https://sentry.zendesk.com/hc/en-us" onClick={trackClickNeedHelp}>
      {t('Need help?')}
    </NeedHelpLink>
  );

  return (
    <HeaderActionBar gap={2}>
      <SecondaryCTAWrapper>{cta}</SecondaryCTAWrapper>
      <LinkButton
        onClick={trackClickUpgrade}
        href={normalizeUrl(
          `/settings/${organization.slug}/billing/checkout/?referrer=upgrade-${source}`
        )}
        external
        size="sm"
        icon={<IconBusiness />}
        priority="default"
      >
        {t('Upgrade Now')}
      </LinkButton>
    </HeaderActionBar>
  );
}

export default withSubscription(withOrganization(TargetedOnboardingHeader), {
  noLoader: true,
});

const HeaderActionBar = styled(ButtonBar)`
  margin-left: ${space(2)};
`;

const SecondaryCTAWrapper = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const NeedHelpLink = styled(ExternalLink)`
  white-space: nowrap;
`;

const ActiveTrialHeader = styled('div')`
  font-size: 14px;
  text-transform: uppercase;
  color: ${p => p.theme.purple300};
`;

const ActiveTrialWrapper = styled('div')`
  cursor: pointer;
  line-height: normal;
  display: flex;
  flex-direction: column;
  align-items: end;
`;
