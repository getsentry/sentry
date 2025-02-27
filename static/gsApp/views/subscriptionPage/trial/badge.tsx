import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {getTrialDaysLeft, getTrialLength} from 'getsentry/utils/billing';

type Props = {
  organization: Organization;
  subscription: Subscription;
};
const TAG_TYPE = 'promotion';

function TrialBadge({subscription, organization}: Props) {
  if (subscription.isTrial) {
    return (
      <Tag type={TAG_TYPE}>
        <TrialText>
          {tn('%s Day Left', '%s Days Left', getTrialDaysLeft(subscription) || 0)}
        </TrialText>
      </Tag>
    );
  }

  if (subscription.canTrial) {
    return (
      <Tag type={TAG_TYPE}>
        <TrialText>{t('%s Day Trial', getTrialLength(organization))}</TrialText>
      </Tag>
    );
  }
  return null;
}

const TrialText = styled('span')`
  font-weight: 400;
`;

export default TrialBadge;
