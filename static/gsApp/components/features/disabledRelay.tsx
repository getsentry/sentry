import styled from '@emotion/styled';

import {Button, ButtonLabel} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import {IconBroadcast, IconBusiness} from 'sentry/icons';
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

function DisabledRelay({organization, features}: Props) {
  return (
    <PlanFeature {...{organization, features}}>
      {({plan}) => (
        <Panel dashedBorder data-test-id="disabled-relay">
          <EmptyMessage
            size="large"
            icon={<IconBroadcast size="xl" />}
            title={t('Protect your private data and more by running a local Relay')}
            description={tct(
              '[strong: Sentry Relay] offers enterprise-grade data security by providing a standalone service that acts as a middle layer between your application and sentry.io. This feature [planRequirement] or above.',

              {
                strong: <strong />,
                planRequirement: (
                  <strong>{t('requires a %s Plan', displayPlanName(plan))}</strong>
                ),
              }
            )}
            action={
              <ButtonBar>
                <StyledButton
                  priority="primary"
                  icon={<IconBusiness />}
                  onClick={() => openUpsellModal({organization, source: 'feature.relay'})}
                >
                  {t('Learn More')}
                </StyledButton>
                <StyledLearnMoreButton
                  organization={organization}
                  source="feature.relay"
                  href="https://docs.sentry.io/product/relay/"
                  external
                >
                  {t('Documentation')}
                </StyledLearnMoreButton>
              </ButtonBar>
            }
          />
        </Panel>
      )}
    </PlanFeature>
  );
}

export default DisabledRelay;

const ButtonBar = styled('div')`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  margin: -${space(0.75)};
  ${ButtonLabel} {
    white-space: nowrap;
  }
`;

const StyledButton = styled(Button)`
  margin: ${space(0.75)};
`;

const StyledLearnMoreButton = styled(LearnMoreButton)`
  margin: ${space(0.75)};
`;
