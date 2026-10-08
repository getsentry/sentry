import {IconCheckmark} from '@sentry/icons/iconCheckmark';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {EventIdStatus} from 'sentry/views/settings/components/dataScrubbing/types';

type Props = {
  status: EventIdStatus;
};

export function EventIdFieldStatusIcon({status}: Props) {
  switch (status) {
    case EventIdStatus.LOADING:
      return <LoadingIndicator size={16} />;
    case EventIdStatus.LOADED:
      return <IconCheckmark variant="success" />;
    default:
      return null;
  }
}
