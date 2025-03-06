import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PanelAlert from 'sentry/components/panels/panelAlert';
import {IconBusiness} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Hooks} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import LearnMoreButton from 'getsentry/components/features/learnMoreButton';
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
        <StyledPanelAlert type="muted" showIcon>
          <Container>
            {plan !== null ? (
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
            ) : (
              t(
                'Custom Release and Error Message filtering is not available on your plan.'
              )
            )}
            <Button
              size="sm"
              priority="primary"
              icon={<IconBusiness />}
              onClick={() =>
                openUpsellModal({
                  organization,
                  source: 'feature.custom_inbound_filters',
                  defaultSelection: 'event-volume',
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
          </Container>
        </StyledPanelAlert>
      )}
    </PlanFeature>
  );
}

const StyledPanelAlert = styled(PanelAlert)`
  align-items: center;
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content max-content;
  gap: ${space(1)};
  align-items: center;
`;

type HookProps = Parameters<Hooks['feature-disabled:custom-inbound-filters']>[0];

function DisabledCustomInboundFilters(props: HookProps) {
  if (typeof props.children === 'function') {
    return props.children({
      ...props,
      renderDisabled: DisabledAlert,
    });
  }
  return props.children;
}

export default DisabledCustomInboundFilters;
