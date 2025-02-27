import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconBusiness, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Member, Organization} from 'sentry/types/organization';
import isMemberDisabledFromLimit from 'sentry/utils/isMemberDisabledFromLimit';

import UpsellProvider from 'getsentry/components/upsellProvider';
import withSubscription from 'getsentry/components/withSubscription';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {Subscription} from 'getsentry/types';
import {displayPlanName, getBestPlanForUnlimitedMembers} from 'getsentry/utils/billing';

type Props = {
  members: Member[];
  organization: Organization;
  subscription: Subscription;
};

function MemberListHeader({members, organization, subscription}: Props) {
  const hasDisabledMembers = !!members.find(isMemberDisabledFromLimit);
  const {data: billingConfig} = useBillingConfig({organization, subscription});

  const getDefaultView = () => <PanelHeader>{t('Members')}</PanelHeader>;

  if (!hasDisabledMembers) {
    return getDefaultView();
  }

  if (!billingConfig) {
    return getDefaultView();
  }

  // the best plan is the first one that has unlimited members
  const bestPlan = getBestPlanForUnlimitedMembers(billingConfig, subscription);
  if (!bestPlan) {
    return getDefaultView();
  }

  return (
    <PanelHeader hasButtons>
      {t('Members')}
      <Wrapper>
        <IconClose isCircled color="red300" />
        {tct('Multiple members requires [planName] Plan or above', {
          planName: displayPlanName(bestPlan),
        })}
        <UpsellProvider source="member-settings-table-header">
          {({canTrial, onClick}) => (
            <Button
              priority="default"
              size="xs"
              onClick={onClick}
              icon={<IconBusiness />}
              data-test-id="member-settings-table-header-upsell-button"
            >
              {canTrial ? t('Start Trial') : t('Upgrade')}
            </Button>
          )}
        </UpsellProvider>
      </Wrapper>
    </PanelHeader>
  );
}
export default withSubscription(MemberListHeader);

const Wrapper = styled('div')`
  text-transform: none;
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;
