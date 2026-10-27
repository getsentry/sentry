import {IconBusiness} from '@sentry/icons/business';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Overrides} from 'sentry/types/overrides';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
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
        <Alert.Container>
          <Alert
            variant="info"
            showIcon
            trailingItems={
              <Button
                size="xs"
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
            }
          >
            {plan === null
              ? t(
                  'Custom inbound filters are not available on your plan. Saved filters are kept but not applied.'
                )
              : tct(
                  'Custom inbound filters are available to [planRequirement] and above. Saved filters are kept but not applied.',
                  {
                    planRequirement: (
                      <strong>{t('%s plans', displayPlanName(plan))}</strong>
                    ),
                  }
                )}
          </Alert>
        </Alert.Container>
      )}
    </PlanFeature>
  );
}

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
