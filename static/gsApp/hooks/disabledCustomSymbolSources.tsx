import styled from '@emotion/styled';

import {Button, ButtonLabel} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyMessage from 'sentry/components/emptyMessage';
import {IconBusiness, IconLock} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import LearnMoreButton from 'getsentry/components/features/learnMoreButton';
import PlanFeature from 'getsentry/components/features/planFeature';
import {displayPlanName} from 'getsentry/utils/billing';

const FEATURE = 'custom-symbol-sources';

type Props = {
  organization: Organization;
};

function DisabledCustomSymbolSources({organization}: Props) {
  return (
    <Content
      data-test-id={`disabled-${FEATURE}`}
      size="large"
      icon={<IconLock size="xl" />}
      title={tct('Configuring custom repositories [requiredPlan]', {
        requiredPlan: (
          <PlanFeature organization={organization} features={[FEATURE]}>
            {({plan}) =>
              tct('requires a [planName] Plan or above.', {
                planName: displayPlanName(plan),
              })
            }
          </PlanFeature>
        ),
      })}
      description={tct(
        '[strong: Sentry] can download debug information files from custom repositories. This allows you to stop uploading debug files and instead configure an HTTP symbol server, Amazon S3 bucket, Google Cloud Storage bucket or an App Store Connect.',
        {
          strong: <strong />,
        }
      )}
      action={
        <ButtonBar gap={0.75}>
          <StyledButton
            priority="primary"
            icon={<IconBusiness />}
            onClick={() =>
              openUpsellModal({
                organization,
                source: `feature.${FEATURE}`,
              })
            }
          >
            {t('Learn More')}
          </StyledButton>
          <StyledLearnMoreButton
            organization={organization}
            source={`feature.${FEATURE}`}
            href="https://docs.sentry.io/platforms/native/data-management/debug-files/symbol-servers/"
            external
          >
            {t('Documentation')}
          </StyledLearnMoreButton>
        </ButtonBar>
      }
    />
  );
}

export default DisabledCustomSymbolSources;

const Content = styled(EmptyMessage)`
  padding: 0;
`;

const StyledButton = styled(Button)`
  margin: ${space(0.75)};
  ${ButtonLabel} {
    white-space: nowrap;
  }
`;

const StyledLearnMoreButton = styled(LearnMoreButton)`
  margin: ${space(0.75)};
`;
