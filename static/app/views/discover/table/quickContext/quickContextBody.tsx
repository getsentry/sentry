import type {Location} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {EventData, EventView} from 'sentry/utils/discover/eventView';

import {EventContext} from './eventContext';
import {IssueContext} from './issueContext';
import {ReleaseContext} from './releaseContext';
import {NoContextWrapper} from './styles';
import {ContextType} from './utils';

interface QuickContextBodyProps {
  contextType: ContextType;
  dataRow: EventData;
  organization: Organization;
  eventView?: EventView;
  location?: Location;
  projects?: Project[];
}

/**
 * The hovercard body for each context type. QuickContextHovercard loads this on
 * demand, so the context views (including the stack trace preview) aren't
 * imported until a hovercard opens.
 */
export default function QuickContextBody({
  contextType,
  dataRow,
  organization,
  eventView,
  location,
  projects,
}: QuickContextBodyProps) {
  switch (contextType) {
    case ContextType.ISSUE:
      return <IssueContext dataRow={dataRow} organization={organization} />;
    case ContextType.RELEASE:
      return <ReleaseContext dataRow={dataRow} organization={organization} />;
    case ContextType.EVENT:
      return (
        <EventContext
          dataRow={dataRow}
          organization={organization}
          location={location}
          projects={projects}
          eventView={eventView}
        />
      );
    default:
      return <NoContextWrapper>{t('There is no context available.')}</NoContextWrapper>;
  }
}
