import type {Organization} from 'sentry/types/organization';

import GSBanner from 'getsentry/components/gsBanner';
import useFeedbackInit from 'getsentry/utils/useFeedbackInit';
import useReplayInit from 'getsentry/utils/useReplayInit';

interface Props {
  organization: Organization;
}

export function OrganizationHeader({organization}: Props) {
  useFeedbackInit();
  useReplayInit();

  return <GSBanner organization={organization} />;
}
