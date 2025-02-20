import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconBusiness} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Plan} from 'getsentry/types';
import {displayPlanName} from 'getsentry/utils/billing';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';

import DashboardBackground from './illustrations/dashboardsBackground';
import PageUpsellOverlay from './pageUpsellOverlay';
import PlanFeature from './planFeature';

type Props = React.PropsWithChildren<{
  features: string[];
  organization: Organization;
}>;

const TextWrapper = styled('div')`
  width: 500px;
`;

function DisabledDashboardPage({
  organization,
  children: _children,
  features,
  ...props
}: Props) {
  const renderPlan = ({plan}: {plan: Plan | null}) => (
    <strong>{t('%s Plan', displayPlanName(plan))}</strong>
  );
  const requiredPlan = tct(
    `Upgrade to our [basicPlan] to view Dashboards and to our [advancedPlan]
     to build and customize your own.`,
    {
      basicPlan: (
        <PlanFeature organization={organization} features={['dashboards-basic']}>
          {renderPlan}
        </PlanFeature>
      ),
      advancedPlan: (
        <PlanFeature organization={organization} features={['dashboards-edit']}>
          {renderPlan}
        </PlanFeature>
      ),
    }
  );

  const description = (
    <Fragment>
      <p>
        {t(
          "Data you don't need isn't helpful. Customize your organization's dashboard with time series graphs, maps, tables, and more"
        )}
      </p>
      <FeatureList
        symbol={<IconBusiness size="sm" />}
        data-test-id="dashboard-feature-list"
      >
        <ListItem>{t('Build and share dashboards')}</ListItem>
        <ListItem>{t('Easily customize widgets')}</ListItem>
        <ListItem>{t('Manage dashboards')}</ListItem>
        <ListItem>{t('Open widgets in Discover')}</ListItem>
      </FeatureList>
    </Fragment>
  );

  // emit the event when the page is loaded
  useEffect(() => {
    trackGetsentryAnalytics('growth.disabled_dashboard.viewed', {
      organization,
    });
  }, [organization]);

  return (
    <PageUpsellOverlay
      name={t('Dashboards Just Got Personal')}
      source="dashboards"
      description={description}
      data-test-id="mock-dashboards-page"
      organization={organization}
      requiredPlan={requiredPlan}
      features={features}
      background={DashboardBackground}
      defaultUpsellSelection="custom-dashboards"
      customWrapper={TextWrapper}
      positioningStrategy={({mainRect, anchorRect, wrapperRect}) => {
        // Center within the anchor on the x axis, until the wrapper is larger
        // than the anchor, then align the wrapper to the right within anchor.
        let x =
          (anchorRect.width - wrapperRect.width) /
            (anchorRect.width > wrapperRect.width ? 2 : 1) +
          anchorRect.x -
          mainRect.x;

        // Avoid overflowing onto the left of the page
        x = Math.max(20, x);

        // Vertically center within the anchor
        const y =
          (anchorRect.height - wrapperRect.height + 40) / 2 + anchorRect.y - mainRect.y;

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

export default DisabledDashboardPage;
