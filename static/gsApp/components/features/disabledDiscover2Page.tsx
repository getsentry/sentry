import {Fragment} from 'react';
import styled from '@emotion/styled';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconBusiness} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {displayPlanName} from 'getsentry/utils/billing';

import DiscoverBackground from './illustrations/discoverBackground';
import PageUpsellOverlay from './pageUpsellOverlay';
import PlanFeature from './planFeature';

type Props = React.PropsWithChildren<{
  features: string[];
  organization: Organization;
}>;

const TextWrapper = styled('div')`
  width: 550px;
`;

function DisabledDiscover2Page({
  organization,
  children: _children,
  features,
  ...props
}: Props) {
  const requiredPlan = tct(
    `You'll need a [basicPlan] to view your events in Discover, or
     a [queryPlan] to unlock the full functionality of Discover.`,
    {
      basicPlan: (
        <PlanFeature organization={organization} features={['discover-basic']}>
          {({plan}) => (
            <strong data-test-id="upsell-planid">
              {t('%s Plan', displayPlanName(plan))}
            </strong>
          )}
        </PlanFeature>
      ),
      queryPlan: (
        <PlanFeature organization={organization} features={['discover-query']}>
          {({plan}) => (
            <strong data-test-id="upsell-planid">
              {t('%s Plan', displayPlanName(plan))}
            </strong>
          )}
        </PlanFeature>
      ),
    }
  );

  const description = (
    <Fragment>
      <p>
        {t(
          "This isn't just any query builder. Discover helps you go back in time to connect the dots and prevent future mistakes."
        )}
      </p>
      <FeatureList
        symbol={<IconBusiness size="sm" />}
        data-test-id="discover-feature-list"
      >
        <ListItem>{t('Define custom functions')}</ListItem>
        <ListItem>{t('Export query results')}</ListItem>
        <ListItem>{t('Save and share queries')}</ListItem>
        <ListItem>{t('Visualize top results')}</ListItem>
      </FeatureList>
    </Fragment>
  );

  return (
    <PageUpsellOverlay
      name={t('Like time travel for queries')}
      source="discover2"
      description={description}
      data-test-id="mock-discover2-page"
      organization={organization}
      requiredPlan={requiredPlan}
      features={features}
      background={DiscoverBackground}
      defaultUpsellSelection="discover-query"
      animateDelay={0.8}
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
        x = x < 30 ? 30 : x;

        return {x, y: anchorRect.y};
      }}
      {...props}
    />
  );
}

const FeatureList = styled(List)`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

export default DisabledDiscover2Page;
