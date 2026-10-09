import styled from '@emotion/styled';
import {IconBusiness} from '@sentry/icons/business';

import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Overrides} from 'sentry/types/overrides';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {LearnMoreButton} from 'getsentry/components/features/learnMoreButton';
import PlanFeature from 'getsentry/components/features/planFeature';
import {displayPlanName} from 'getsentry/utils/billing';

type Props = {
  features: string[];
  organization: Organization;
};

function DisabledAlert({organization, features}: Props) {
  return (
    <PlanFeature {...{organization, features}}>
      {({plan}) => (
        <StyledPanelAlert variant="muted">
          <Grid align="center" gap="md" columns="1fr max-content max-content">
            {plan === null ? (
              t(
                'Custom Release and Error Message filtering is not available on your plan.'
              )
            ) : (
              <span>
                {tct(
                  'Custom Release and Error Message filtering is available to [planRequirement] and above.',
                  {
                    planRequirement: (
                      <strong>{t('%s plans', displayPlanName(plan))}</strong>
                    ),
                  }
                )}
              </span>
            )}
            <Button
              size="sm"
              variant="primary"
              icon={<IconBusiness />}
              onClick={() =>
                openUpsellModal({
                  organization,
                  source: 'feature.custom_inbound_filters',
                })
              }
            >
              {t('Learn More')}
            </Button>
            <LearnMoreButton
              organization={organization}
              source="feature.custom_inbound_filters"
              size="sm"
              href="https://docs.sentry.io/accounts/quotas/#id1"
              external
            >
              {t('Documentation')}
            </LearnMoreButton>
          </Grid>
        </StyledPanelAlert>
      )}
    </PlanFeature>
  );
}

const StyledPanelAlert = styled(PanelAlert)`
  align-items: center;
`;

type OverrideProps = Parameters<Overrides['feature-disabled:custom-inbound-filters']>[0];

export function DisabledCustomInboundFilters(props: OverrideProps) {
  if (typeof props.children === 'function') {
    return props.children({
      ...props,
      renderDisabled: DisabledAlert,
    });
  }
  return props.children;
}
