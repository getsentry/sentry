import {Fragment} from 'react';
import styled from '@emotion/styled';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconBusiness} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {displayPlanName, hasPerformance} from 'getsentry/utils/billing';

import withSubscription from '../withSubscription';

import AlertsBackground from './illustrations/alertsBackground';
import PageUpsellOverlay from './pageUpsellOverlay';
import PlanFeature from './planFeature';

type Props = React.PropsWithChildren<{
  features: string[];
  organization: Organization;
  subscription: Subscription;
}>;

const TextWrapper = styled('div')`
  width: 550px;
`;

function DisabledAlertsPage({
  organization,
  subscription,
  features,
  children: _children,
  ...props
}: Props) {
  const requiredPlan = tct(`You'll need a [plan] or up to view metric alerts.`, {
    plan: (
      <PlanFeature organization={organization} features={features}>
        {({plan}) => (
          <strong data-test-id="upsell-planid">
            {t('%s Plan', displayPlanName(plan))}
          </strong>
        )}
      </PlanFeature>
    ),
  });

  const description = (
    <Fragment>
      <p>
        {t(
          'Sure, we like attention as much as the next app. But we don’t want to send notifications you don’t need. Set your own alert rules.'
        )}
      </p>
      <FeatureList symbol={<IconBusiness size="sm" />}>
        <ListItem>{t('Set critical thresholds')}</ListItem>
        <ListItem>{t('Automate resolution')}</ListItem>
        <ListItem>{t('Identify key events to watch')}</ListItem>
        <ListItem>{t('Create custom triggers')}</ListItem>
      </FeatureList>
    </Fragment>
  );

  return (
    <PageUpsellOverlay
      name={t('Choose your alerts')}
      source={
        hasPerformance(subscription.planDetails) ? 'incidents' : 'incidents-performance'
      }
      description={description}
      data-test-id="mock-incidents-page"
      organization={organization}
      requiredPlan={requiredPlan}
      features={features}
      background={AlertsBackground}
      customWrapper={TextWrapper}
      positioningStrategy={({mainRect, anchorRect, wrapperRect}) => {
        // Vertically center within the anchor
        const y =
          (anchorRect.height - wrapperRect.height + 40) / 2 + anchorRect.y - mainRect.y;

        // Align to the right of the anchor, avoid overflowing outside of the
        // page, the best we can do is start to overlap the illustration at
        // this point.
        let x = anchorRect.x - mainRect.x - wrapperRect.width;
        x = x < 30 ? 30 : x;

        return {x, y};
      }}
      {...props}
    />
  );
}

const FeatureList = styled(List)`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

export default withSubscription(DisabledAlertsPage);
