import type {Organization} from 'sentry/types/organization';

import GSBanner from 'getsentry/components/gsBanner';
import {useFeedbackInit} from 'getsentry/utils/useFeedbackInit';

interface Props {
  organization: Organization;
}

export function OrganizationHeader({organization}: Props) {
  useFeedbackInit();

  return <GSBanner organization={organization} />;
}
