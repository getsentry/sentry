import type {Organization} from 'sentry/types/organization';

import GSBanner from 'getsentry/components/gsBanner';
import useFeedbackInit from 'getsentry/utils/useFeedbackInit';
import {useIntercomInit} from 'getsentry/utils/useIntercomInit';
import useReplayInit from 'getsentry/utils/useReplayInit';

interface Props {
  organization: Organization;
}

export function OrganizationHeader({organization}: Props) {
  useFeedbackInit();
  useReplayInit();
  useIntercomInit();

  return <GSBanner organization={organization} />;
}
