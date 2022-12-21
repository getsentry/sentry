import {t, tn} from 'sentry/locale';
import {EventAttachment} from 'sentry/types';

import EventDataSection from './eventDataSection';

type Props = {
  viewHierarchies: EventAttachment[];
};
function EventViewHierarchy({viewHierarchies}: Props) {
  if (!viewHierarchies.length) {
    return null;
  }

  return (
    <EventDataSection
      type="view_hierarchy"
      title={tn('View Hierarchy', 'View Hierarchies', viewHierarchies.length)}
    >
      View Hierarchy
    </EventDataSection>
  );
}

export {EventViewHierarchy};
