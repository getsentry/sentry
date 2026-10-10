import {IconBusiness} from '@sentry/icons/business';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import type {Member, Organization} from 'sentry/types/organization';
import {isMemberDisabledFromLimit} from 'sentry/utils/isMemberDisabledFromLimit';

import UpsellProvider from 'getsentry/components/upsellProvider';
import {withSubscription} from 'getsentry/components/withSubscription';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {Subscription} from 'getsentry/types';
import {displayPlanName, getBestPlanForUnlimitedMembers} from 'getsentry/utils/billing';

type Props = {
  members: Member[];
  organization: Organization;
  subscription: Subscription;
};

function MemberListHeader({members, organization, subscription}: Props) {
  const hasDisabledMembers = members.some(isMemberDisabledFromLimit);
  const {data: billingConfig} = useBillingConfig({organization});

  if (!hasDisabledMembers || !billingConfig) {
    return null;
  }

  // the best plan is the first one that has unlimited members
  const bestPlan = getBestPlanForUnlimitedMembers(billingConfig, subscription);
  if (!bestPlan) {
    return null;
  }

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell column="1 / -1" gap="md" wrap="wrap">
        <IconClose variant="danger" />
        {tct('Multiple members requires [planName] Plan or above', {
          planName: displayPlanName(bestPlan),
        })}
        <UpsellProvider source="member-settings-table-header">
          {({canTrial, onClick}) => (
            <Button
              variant="secondary"
              size="xs"
              onClick={onClick}
              icon={<IconBusiness />}
              data-test-id="member-settings-table-header-upsell-button"
            >
              {canTrial ? t('Start Trial') : t('Upgrade')}
            </Button>
          )}
        </UpsellProvider>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
export default withSubscription(MemberListHeader, {noLoader: true});
