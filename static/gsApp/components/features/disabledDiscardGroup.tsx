import styled from '@emotion/styled';
import {IconBusiness} from '@sentry/icons/business';
import {IconDelete} from '@sentry/icons/delete';

import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import {LearnMoreButton} from 'getsentry/components/features/learnMoreButton';
import PlanFeature from 'getsentry/components/features/planFeature';
import {displayPlanName} from 'getsentry/utils/billing';

type Props = {
  features: Organization['features'];
  organization: Organization;
};

export function DisabledDiscardGroup({organization, features}: Props) {
  return (
    <PlanFeature {...{organization, features}}>
      {({plan}) => (
        <StyledEmptyMessage
          icon={<IconDelete />}
          title={t('Keep the noise down')}
          action={
            <Grid gap="md" flow="column">
              <Button
                size="sm"
                variant="primary"
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
            </Grid>
          }
        >
          {plan === null
            ? t(
                `Discard and Delete is not available on your plan. Contact
                 us to migrate to a plan that supports discarding any
                 future events like this before they reach your stream.`
              )
            : tct(
                '[strong:Discard and Delete] allows you to discard any future events before they reach your stream. This feature [planRequirement] or above.',
                {
                  strong: <strong />,
                  planRequirement: (
                    <strong>{t('requires a %s Plan', displayPlanName(plan))}</strong>
                  ),
                }
              )}
        </StyledEmptyMessage>
      )}
    </PlanFeature>
  );
}

const StyledEmptyMessage = styled(EmptyMessage)`
  padding: 0;
`;
