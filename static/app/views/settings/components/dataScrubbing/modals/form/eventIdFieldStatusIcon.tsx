import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark} from 'sentry/icons';
import {EventIdStatus} from 'sentry/views/settings/components/dataScrubbing/types';

type Props = {
  status: EventIdStatus;
};

function EventIdFieldStatusIcon({status}: Props) {
  switch (status) {
    case EventIdStatus.LOADING:
      return <LoadingIndicator size={16} />;
    case EventIdStatus.LOADED:
      return <IconCheckmark variant="success" />;
    default:
      return null;
  }
}

export default EventIdFieldStatusIcon;
