import {getLeadHint} from 'sentry/components/events/interfaces/frame/utils';
import {Event, Frame} from 'sentry/types';
import {defined} from 'sentry/utils';

type Props = {
  event: Event;
  leadsToApp: boolean;
  isExpanded?: boolean;
  nextFrame?: Frame;
};

function LeadHint({leadsToApp, isExpanded, nextFrame, event}: Props) {
  if (isExpanded || !leadsToApp) {
    return null;
  }

  return (
    <div className="leads-to-app-hint">
      {getLeadHint({event, hasNextFrame: defined(nextFrame)})}
      {': '}
    </div>
  );
}

export default LeadHint;
