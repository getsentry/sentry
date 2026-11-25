import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Grid, type GridProps} from '@sentry/scraps/layout';

import {PageOverlay} from 'sentry/components/pageOverlay';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {UpsellProvider} from 'getsentry/components/upsellProvider';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import {displayPlanName} from 'getsentry/utils/billing';

import {PlanFeature} from './planFeature';

type Props = Omit<React.ComponentProps<typeof PageOverlay>, 'text'> & {
  description: React.ReactNode;
  features: string[];
  name: string;
  organization: Organization;
  requiredPlan: React.ReactNode;
  source: string;
  customSecondaryCTA?: React.ReactNode;
};

/**
 * Wrapper component that will render the wrapped content with a animated upsell
 * overlay.
 *
 * This uses the PageOverlay component and makes it more "upselly".
 */
export function PageUpsellOverlay({
  organization,
  features,
  name,
  description,
  source,
  requiredPlan,
  customSecondaryCTA,
  ...props
}: Props) {
  const subscription = useSubscription({organization});

  if (!subscription) {
    return null;
  }

  const requiredPlanContents =
    requiredPlan ??
    tct("You'll need the [plan] or up to access [name]", {
      name,
      plan: (
        <PlanFeature {...{organization, features}}>
          {({plan}) => (
            <strong data-test-id="upsell-planid">
              {t('%s Plan', displayPlanName(plan))}
            </strong>
          )}
        </PlanFeature>
      ),
    });

  return (
    <PageOverlay
      text={({Header, Body}) => (
        <Fragment>
          <Header>{name}</Header>
          <Body>{description}</Body>
          <Body css={theme => `font-size: ${theme.font.size.md}`}>
            {requiredPlanContents}
          </Body>
          <Body>
            <StyledButtonBar>
              {subscription.canSelfServe && (
                <UpsellProvider
                  source={source}
                  organization={organization}
                  triggerMemberRequests
                >
                  {({defaultButtonText, onClick}) => (
                    <Button variant="primary" size="sm" onClick={onClick}>
                      {defaultButtonText}
                    </Button>
                  )}
                </UpsellProvider>
              )}
              {customSecondaryCTA ?? (
                <Button onClick={() => openUpsellModal({organization, source})} size="sm">
                  {t('Learn More')}
                </Button>
              )}
            </StyledButtonBar>
          </Body>
        </Fragment>
      )}
      {...props}
    />
  );
}

const StyledButtonBar = styled((props: GridProps) => (
  <Grid flow="column" align="center" gap="md" {...props} />
))`
  width: fit-content;
`;
