import {Fragment} from 'react';

import Link from 'sentry/components/links/link';
import {useReplayGroupContext} from 'sentry/components/replays/replayGroupContext';
import {getShortEventId} from 'sentry/utils/events';
import type {ErrorFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';

export default function CrumbErrorTitle({frame}: {frame: ErrorFrame}) {
  const organization = useOrganization();
  const {eventId} = useReplayGroupContext();

  if (eventId === frame.data.eventId) {
    return <Fragment>Error: This Event</Fragment>;
  }

  return (
    <Fragment>
      Error:{' '}
      <Link
        to={`/organizations/${organization.slug}/issues/${frame.data.groupId}/events/${frame.data.eventId}/#replay`}
      >
        {getShortEventId(frame.data.eventId)}
      </Link>
    </Fragment>
  );
}
