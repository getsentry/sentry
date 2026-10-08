import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {IconBusiness} from 'sentry/icons';
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
          <Container>
            {plan === null ? (
              t(
                'Custom inbound filters are not available on your plan. Saved filters are kept but not applied.'
              )
            ) : (
              <span>
                {tct(
                  'Custom inbound filters are available to [planRequirement] and above. Saved filters are kept but not applied.',
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
  gap: ${p => p.theme.space.md};
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
