import {Fragment} from 'react';
import styled from '@emotion/styled';

import DemoSandboxButton from 'sentry/components/demoSandboxButton';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {IconBusiness} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import PerformanceBackground from './illustrations/performanceBackground';
import PageUpsellOverlay from './pageUpsellOverlay';

type Props = React.PropsWithChildren<{
  features: string[];
  organization: Organization;
}>;

const TextWrapper = styled('div')`
  width: 550px;
`;

function DisabledPerformancePage({
  organization,
  children: _children,
  features,
  ...props
}: Props) {
  const requiredPlan = tct(
    `You'll need to migrate to a new plan with [strong:Transactions] to access Performance.`,
    {
      strong: <strong />,
    }
  );

  const description = (
    <Fragment>
      <p>
        {t(
          'Load times getting longer? Visitors losing patience? Customers grabbing pitchforks? We’ll help. '
        )}
      </p>
      <FeatureList
        symbol={<IconBusiness size="sm" />}
        data-test-id="performance-feature-list"
      >
        <ListItem>{t('Visualize latency percentiles')}</ListItem>
        <ListItem>{t('Sort by apdex & throughput')}</ListItem>
        <ListItem>{t('Monitor user misery')}</ListItem>
        <ListItem>{t('See related issues')}</ListItem>
      </FeatureList>
    </Fragment>
  );

  const SandboxButton = organization.features.includes('sandbox-kill-switch') ? null : (
    <DemoSandboxButton
      scenario="oneTransaction"
      projectSlug="react"
      size="sm"
      clientData={{
        skipEmail: true,
        cta: {
          id: 'disabled-performance-page',
          title: t('Upgrade Now'),
          shortTitle: t('Upgrade'),
          url: new URL(
            `/settings/${organization.slug}/billing/checkout/`,
            window.location.origin
          ).toString(),
        },
      }}
    >
      {t('See a Sample Transaction')}
    </DemoSandboxButton>
  );

  return (
    <PageUpsellOverlay
      name={t('Spot slowdowns')}
      source="performance-view"
      description={description}
      data-test-id="mock-performance-page"
      organization={organization}
      requiredPlan={requiredPlan}
      features={features}
      background={PerformanceBackground}
      customWrapper={TextWrapper}
      customSecondaryCTA={SandboxButton}
      positioningStrategy={({mainRect, anchorRect, wrapperRect}) => {
        let y = anchorRect.y - mainRect.y - wrapperRect.height;

        // Center within the anchor on the x axis, until the wrapper is larger
        // than the anchor, then align the wrapper to the right within anchor.
        let x =
          (anchorRect.width - wrapperRect.width) /
            (anchorRect.width > wrapperRect.width ? 2 : 1) +
          anchorRect.x -
          mainRect.x;

        // Avoid overflowing onto the left of the page
        x = Math.max(30, x);

        // Avoid cutting off the top on smaller screens
        y = Math.max(30, y);

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

export default DisabledPerformancePage;
