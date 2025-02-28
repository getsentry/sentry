import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import {IconBusiness, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import LearnMoreButton from 'getsentry/components/features/learnMoreButton';
import PlanFeature from 'getsentry/components/features/planFeature';
import {displayPlanName} from 'getsentry/utils/billing';

type Props = {
  features: Organization['features'];
  organization: Organization;
};

function DisabledDiscardGroup({organization, features}: Props) {
  return (
    <PlanFeature {...{organization, features}}>
      {({plan}) => (
        <StyledEmptyMessage
          icon={<IconDelete />}
          title={t('Keep the noise down')}
          description={
            plan !== null
              ? tct(
                  '[strong:Discard and Delete] allows you to discard any future events before they reach your stream. This feature [planRequirement] or above.',
                  {
                    strong: <strong />,
                    planRequirement: (
                      <strong>{t('requires a %s Plan', displayPlanName(plan))}</strong>
                    ),
                  }
                )
              : t(
                  `Discard and Delete is not available on your plan. Contact
                 us to migrate to a plan that supports discarding any
                 future events like this before they reach your stream.`
                )
          }
          action={
            <ButtonGroup>
              <Button
                size="sm"
                priority="primary"
                icon={<IconBusiness />}
                onClick={() =>
                  openUpsellModal({
                    organization,
                    source: 'feature.discard_group',
                  })
                }
              >
                {t('Learn More')}
              </Button>
              <LearnMoreButton
                organization={organization}
                size="sm"
                source="feature.discard_group"
                href="https://blog.sentry.io/2018/01/03/delete-and-discard"
                external
              >
                {t('About Discard and Delete')}
              </LearnMoreButton>
            </ButtonGroup>
          }
        />
      )}
    </PlanFeature>
  );
}

const StyledEmptyMessage = styled(EmptyMessage)`
  padding: 0;
`;

const ButtonGroup = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
`;

export default DisabledDiscardGroup;
