import {Fragment, useCallback, type MouseEvent} from 'react';
import capitalize from 'lodash/capitalize';

import {Link} from 'sentry/components/core/link';
import {useReplayGroupContext} from 'sentry/components/replays/replayGroupContext';
import {getShortEventId} from 'sentry/utils/events';
import type {ErrorFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';

export default function CrumbErrorTitle({frame}: {frame: ErrorFrame}) {
  const organization = useOrganization();
  const {eventId} = useReplayGroupContext();
  const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
  }, []);

  if (eventId === frame.data.eventId) {
    return <Fragment>Error: This Event</Fragment>;
  }

  const level = frame.data.level || 'error';

  return (
    <Fragment>
      {capitalize(level)}:{' '}
      <Link
        onClick={handleClick}
        to={`/organizations/${organization.slug}/issues/${frame.data.groupId}/events/${frame.data.eventId}/#replay`}
      >
        {getShortEventId(frame.data.eventId)}
      </Link>
    </Fragment>
  );
}
