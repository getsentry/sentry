import {Alert} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeStatsPathname} from 'sentry/views/organizationStats/pathname';

type Props = {
  project: Project;
  /**
   * - `event-all`: none of the event's attachments were stored
   * - `event-some`: some of the event's attachments were stored
   * - `issue`: some events in the issue had attachments that were not stored
   */
  variant: 'event-all' | 'event-some' | 'issue';
};

function getMessage(variant: Props['variant'], statsLink: React.ReactElement) {
  switch (variant) {
    case 'event-all':
      return tct(
        "This event had attachments, but they weren't stored because your attachment quota was exceeded at the time the event was ingested. [statsLink:View your attachment usage].",
        {statsLink}
      );
    case 'event-some':
      return tct(
        "Some of this event's attachments weren't stored because your attachment quota was exceeded at the time the event was ingested. [statsLink:View your attachment usage].",
        {statsLink}
      );
    case 'issue':
      return tct(
        'Some attachments may be missing from this list because your attachment quota was exceeded at the time the event was ingested. [statsLink:View your attachment usage].',
        {statsLink}
      );
  }
}

export function EventAttachmentsQuotaExceededNotice({project, variant}: Props) {
  const organization = useOrganization();
  const statsUrl = {
    pathname: makeStatsPathname({path: '/', organization}),
    query: {dataCategory: 'attachments', project: project.id},
  };

  return (
    <Alert.Container>
      <Alert variant="warning">{getMessage(variant, <Link to={statsUrl} />)}</Alert>
    </Alert.Container>
  );
}
