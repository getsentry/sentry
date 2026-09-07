import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Grid, type GridProps} from '@sentry/scraps/layout';

import {IconBusiness, IconQuestion} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {withSubscription} from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {getTrialDaysLeft, isTrial} from 'getsentry/utils/billing';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  source: string;
  subscription: Subscription;
};

function TargetedOnboardingHeader({source, subscription}: Props) {
  const organization = useOrganization();

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
  const cta = isTrial(subscription) ? (
    <ActiveTrialWrapper
      onClick={() => openUpsellModal({organization, source: 'targeted-onboarding'})}
    >
      <ActiveTrialHeader>{t('Trial is Active')}</ActiveTrialHeader>
      <div>{tn('%s Day Left', '%s Days Left', getTrialDaysLeft(subscription) || 0)}</div>
    </ActiveTrialWrapper>
  ) : (
    <LinkButton
      href="https://www.sentry.help"
      external
      onClick={trackClickNeedHelp}
      size="xs"
      icon={<IconQuestion />}
      variant="transparent"
      aria-label={t('Help Center')}
      tooltipProps={{title: t('Help Center')}}
    />
  );

  return (
    <HeaderActionBar>
      {cta}
      <LinkButton
        onClick={trackClickUpgrade}
        href={normalizeUrl(`/checkout/${organization.slug}/?referrer=upgrade-${source}`)}
        external
        size="xs"
        icon={<IconBusiness />}
        variant="transparent"
      >
        {t('Upgrade Now')}
      </LinkButton>
    </HeaderActionBar>
  );
}

export default withSubscription(TargetedOnboardingHeader, {
  noLoader: true,
});

const HeaderActionBar = styled((props: GridProps) => (
  <Grid flow="column" align="center" gap="md" {...props} />
))`
  margin-left: ${p => p.theme.space.xl};
`;

const ActiveTrialHeader = styled('div')`
  font-size: 14px;
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.accent};
  white-space: nowrap;
`;

const ActiveTrialWrapper = styled('div')`
  cursor: pointer;
  line-height: normal;
  display: flex;
  flex-direction: column;
  align-items: end;
`;
