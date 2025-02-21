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
            <span>
              {plan !== null
                ? tct(
                    'Custom Rate Limits are available to [planRequirement] and above.',
                    {
                      planRequirement: (
                        <strong>{t('%s plans', displayPlanName(plan))}</strong>
                      ),
                    }
                  )
                : t('Custom Rate Limits are not available on your plan.')}
            </span>
            <Button
              size="sm"
              priority="primary"
              icon={<IconBusiness />}
              data-test-id="rate-limit-upsell"
              onClick={() =>
                openUpsellModal({
                  organization,
                  source: 'feature.rate_limits',
                  defaultSelection: 'event-volume',
                })
              }
            >
              {t('Learn More')}
            </Button>
            <LearnMoreButton
              organization={organization}
              source="feature.rate_limits"
              size="sm"
              external
              href="https://docs.sentry.io/accounts/quotas/#id1"
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

type HookProps = Parameters<Hooks['feature-disabled:rate-limits']>[0];

function DisabledRateLimits(props: HookProps) {
  if (typeof props.children === 'function') {
    return props.children({
      ...props,
      renderDisabled: DisabledAlert,
    });
  }
  return props.children;
}

export default DisabledRateLimits;
