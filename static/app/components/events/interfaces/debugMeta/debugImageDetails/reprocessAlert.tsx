import {useCallback, useEffect, useState} from 'react';

import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import AlertLink from 'sentry/components/alertLink';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

enum ReprocessableEventReason {
  // It can have many reasons. The event is too old to be reprocessed (very unlikely!)
  // or was not a native event.
  UNPROCESSED_EVENT_NOT_FOUND = 'unprocessed_event.not_found',
  // The event does not exist.
  EVENT_NOT_FOUND = 'event.not_found',
  // A required attachment, such as the original minidump, is missing.
  ATTACHMENT_NOT_FOUND = 'attachment.not_found',
}

type ReprocessableEvent = {
  reprocessable: boolean;
  reason?: ReprocessableEventReason;
};

type Props = {
  api: Client;
  eventId: Event['id'];
  onReprocessEvent: () => void;
  orgSlug: Organization['slug'];
  projSlug: Project['slug'];
};

function ReprocessAlert({onReprocessEvent, api, orgSlug, projSlug, eventId}: Props) {
  const [reprocessableEvent, setReprocessableEvent] = useState<
    undefined | ReprocessableEvent
  >();

  const checkEventReprocessable = useCallback(async () => {
    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projSlug}/events/${eventId}/reprocessable/`
      );
      setReprocessableEvent(response);
    } catch {
      // do nothing
    }
  }, [api, eventId, orgSlug, projSlug]);

  useEffect(() => {
    checkEventReprocessable();
  }, [checkEventReprocessable]);

  if (!reprocessableEvent) {
    return null;
  }

  const {reprocessable, reason} = reprocessableEvent;

  if (reprocessable) {
    return (
      <AlertLink
        priority="warning"
        size="small"
        onClick={onReprocessEvent}
        withoutMarginBottom
      >
        {t(
          'You’ve uploaded new debug files. Reprocess events in this issue to view a better stack trace'
        )}
      </AlertLink>
    );
  }

  function getAlertInfoMessage() {
    switch (reason) {
      case ReprocessableEventReason.EVENT_NOT_FOUND:
        return t('This event cannot be reprocessed because the event has not been found');
      case ReprocessableEventReason.ATTACHMENT_NOT_FOUND:
        return t(
          'This event cannot be reprocessed because a required attachment is missing'
        );
      case ReprocessableEventReason.UNPROCESSED_EVENT_NOT_FOUND:
      default:
        return t('This event cannot be reprocessed');
    }
  }

  return <Alert type="info">{getAlertInfoMessage()}</Alert>;
}

export default ReprocessAlert;
