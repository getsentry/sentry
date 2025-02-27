import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import PageOverlay from 'sentry/components/pageOverlay';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import UpsellProvider from 'getsentry/components/upsellProvider';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {displayPlanName} from 'getsentry/utils/billing';

import PlanFeature from './planFeature';

type Props = Omit<React.ComponentProps<typeof PageOverlay>, 'text'> & {
  description: React.ReactNode;
  features: string[];
  name: string;
  organization: Organization;
  requiredPlan: React.ReactNode;
  source: string;
  subscription: Subscription;
  customSecondaryCTA?: React.ReactNode;
  defaultUpsellSelection?: string;
};

/**
 * Wrapper component that will render the wrapped content with a animated upsell
 * overlay.
 *
 * This uses the PageOverlay component and makes it more "upselly".
 */
function PageUpsellOverlay({
  organization,
  subscription,
  features,
  name,
  description,
  source,
  requiredPlan,
  customSecondaryCTA,
  defaultUpsellSelection,
  ...props
}: Props) {
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
          <Body css={theme => `font-size: ${theme.fontSizeMedium}`}>
            {requiredPlanContents}
          </Body>
          <Body>
            <StyledButtonBar gap={1}>
              {subscription?.canSelfServe && (
                <UpsellProvider
                  source={source}
                  organization={organization}
                  triggerMemberRequests
                >
                  {({defaultButtonText, onClick}) => (
                    <Button priority="primary" size="sm" onClick={onClick}>
                      {defaultButtonText}
                    </Button>
                  )}
                </UpsellProvider>
              )}
              {customSecondaryCTA ?? (
                <Button
                  onClick={() =>
                    openUpsellModal({
                      organization,
                      source,
                      defaultSelection: defaultUpsellSelection,
                    })
                  }
                  size="sm"
                >
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

const StyledButtonBar = styled(ButtonBar)`
  width: fit-content;
`;

export default withSubscription(PageUpsellOverlay, {noLoader: true});
