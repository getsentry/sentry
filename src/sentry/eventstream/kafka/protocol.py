from __future__ import absolute_import

import pytz
import logging
from datetime import datetime

from sentry.models import Event
from sentry.utils import json


logger = logging.getLogger(__name__)


class UnexpectedOperation(Exception):
    pass


def handle_version_1_message(operation, event_data, task_state):
    if operation == 'insert':
        event_data['datetime'] = datetime.strptime(
            event_data['datetime'],
            "%Y-%m-%dT%H:%M:%S.%fZ",
        ).replace(tzinfo=pytz.utc)

        kwargs = {
            'event': Event(**{
                name: event_data[name] for name in [
                    'group_id',
                    'event_id',
                    'project_id',
                    'message',
                    'platform',
                    'datetime',
                    'data',
                ]
            }),
            'primary_hash': event_data['primary_hash'],
        }

        for name in ('is_new', 'is_sample', 'is_regression', 'is_new_group_environment'):
            kwargs[name] = task_state[name]

        return kwargs
    elif operation == 'delete':
        logger.debug('Skipping unsupported operation: %s', operation)
        return None
    else:
        raise UnexpectedOperation('Received unexpected operation type: {!r}'.format(operation))


version_handlers = {
    1: handle_version_1_message,
}


class InvalidPayload(Exception):
    pass


class InvalidVersion(Exception):
    pass


def parse_event_message(value):
    """
    Decodes a message body, returning a dictionary of keyword arguments that
    can be applied to a post-processing task, or ``None`` if no task should be
    dispatched.
    """
    payload = json.loads(value)

    try:
        version = payload[0]
    except Exception:
        raise InvalidPayload('Received event payload with unexpected structure')

    try:
        handler = version_handlers[int(version)]
    except (ValueError, KeyError):
        raise InvalidVersion(
            'Received event payload with unexpected version identifier: {}'.format(version))

    return handler(*payload[1:])
