import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import {IconArrow, IconBusiness} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import LearnMoreButton from 'getsentry/components/features/learnMoreButton';
import PlanFeature from 'getsentry/components/features/planFeature';
import {displayPlanName} from 'getsentry/utils/billing';

type Props = {
  features: string[];
  organization: Organization;
};

function DisabledDataForwarding({organization, features}: Props) {
  return (
    <PlanFeature {...{organization, features}}>
      {({plan}) => (
        <Panel dashedBorder data-test-id="disabled-data-forwarding">
          <EmptyMessage
            size="large"
            icon={<IconArrow direction="right" size="xl" />}
            title={t('Your business intelligence workflow is missing crucial data')}
            description={
              plan !== null
                ? tct(
                    '[strong:Data Forwarding] allows you to send processed events to your favorite business intelligence tools such as Segment, Amazon SQS, and Splunk. This feature [planRequirement] or above.',

                    {
                      strong: <strong />,
                      planRequirement: (
                        <strong>{t('requires a %s Plan', displayPlanName(plan))}</strong>
                      ),
                    }
                  )
                : t(
                    'Data forwarding is not available on your plan. Contact us to migrate to a plan that supports sending your events for processing with your favorite business intelligence tools such as Segment, Amazon SQS, and Splunk.'
                  )
            }
            action={
              <ButtonGroup>
                <Button
                  priority="primary"
                  icon={<IconBusiness />}
                  onClick={() =>
                    openUpsellModal({organization, source: 'feature.data_forwarding'})
                  }
                >
                  {t('Learn More')}
                </Button>
                <LearnMoreButton
                  organization={organization}
                  source="feature.data_forwarding"
                  href="https://docs.sentry.io/product/data-management-settings/data-forwarding/"
                  external
                >
                  {t('Documentation')}
                </LearnMoreButton>
              </ButtonGroup>
            }
          />
        </Panel>
      )}
    </PlanFeature>
  );
}

const ButtonGroup = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1.5)};
`;

export default DisabledDataForwarding;
