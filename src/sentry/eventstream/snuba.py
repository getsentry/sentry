from __future__ import absolute_import

import logging
from datetime import datetime
from uuid import uuid4

import pytz
import six
import urllib3

from sentry import quotas
from sentry.eventstream.base import EventStream
from sentry.utils import snuba, json
from sentry.utils.safe import get_path
from sentry.utils.sdk import set_current_project


logger = logging.getLogger(__name__)


# Version 1 format: (1, TYPE, [...REST...])
#   Insert: (1, 'insert', {
#       ...event json...
#   }, {
#       ...state for post-processing...
#   })
#
#   Mutations that *should be ignored*: (1, ('delete_groups'|'unmerge'|'merge'), {...})
#
#   In short, for protocol version 1 only messages starting with (1, 'insert', ...)
#   should be processed.

# Version 2 format: (2, TYPE, [...REST...])
#   Insert: (2, 'insert', {
#       ...event json...
#   }, {
#       ...state for post-processing...
#   })
#   Delete Groups: (2, '(start_delete_groups|end_delete_groups)', {
#       'transaction_id': uuid,
#       'project_id': id,
#       'group_ids': [id2, id2, id3],
#       'datetime': timestamp,
#   })
#   Merge: (2, '(start_merge|end_merge)', {
#       'transaction_id': uuid,
#       'project_id': id,
#       'previous_group_ids': [id2, id2],
#       'new_group_id': id,
#       'datetime': timestamp,
#   })
#   Unmerge: (2, '(start_unmerge|end_unmerge)', {
#       'transaction_id': uuid,
#       'project_id': id,
#       'previous_group_id': id,
#       'new_group_id': id,
#       'hashes': [hash2, hash2]
#       'datetime': timestamp,
#   })
#   Delete Tag: (2, '(start_delete_tag|end_delete_tag)', {
#       'transaction_id': uuid,
#       'project_id': id,
#       'tag': 'foo',
#       'datetime': timestamp,
#   })


class SnubaProtocolEventStream(EventStream):

    # Beware! Changing this protocol (introducing a new version, or the message
    # format/fields themselves) requires consideration of all downstream
    # consumers. This includes the post-processing forwarder code!
    EVENT_PROTOCOL_VERSION = 2

    # These keys correspond to tags that are typically prefixed with `sentry:`
    # and will wreak havok in the UI if both the `sentry:`-prefixed and
    # non-prefixed variations occur in a response.
    UNEXPECTED_TAG_KEYS = frozenset(["dist", "release", "user"])

    def insert(
        self,
        group,
        event,
        is_new,
        is_regression,
        is_new_group_environment,
        primary_hash,
        received_timestamp,  # type: float
        skip_consume=False,
    ):
        project = event.project
        set_current_project(project.id)
        retention_days = quotas.get_event_retention(organization=project.organization)

        event_data = event.get_raw_data()

        unexpected_tags = set(
            [
                k
                for (k, v) in (get_path(event_data, "tags", filter=True) or [])
                if k in self.UNEXPECTED_TAG_KEYS
            ]
        )
        if unexpected_tags:
            logger.error("%r received unexpected tags: %r", self, unexpected_tags)

        # When migrating old data from Sentry 9.0.0 to 9.1.2 to 10, event.datetime and the underlying event.timestamp
        # may be None. datetime.fromtimestamp will error out because None is not a valid timestamp
        try:
            event_datetime = event.datetime
        except TypeError:
            event_datetime = received_timestamp
        print(event_datetime)

        self._send(
            project.id,
            "insert",
            extra_data=(
                {
                    "group_id": event.group_id,
                    "event_id": event.event_id,
                    "organization_id": project.organization_id,
                    "project_id": event.project_id,
                    # TODO(mitsuhiko): We do not want to send this incorrect
                    # message but this is what snuba needs at the moment.
                    "message": event.search_message,
                    "platform": event.platform,
                    "datetime": event_datetime,
                    "data": event_data,
                    "primary_hash": primary_hash,
                    "retention_days": retention_days,
                },
                {
                    "is_new": is_new,
                    "is_regression": is_regression,
                    "is_new_group_environment": is_new_group_environment,
                    "skip_consume": skip_consume,
                },
            ),
            headers={"Received-Timestamp": six.text_type(received_timestamp)},
        )

    def start_delete_groups(self, project_id, group_ids):
        if not group_ids:
            return

        state = {
            "transaction_id": uuid4().hex,
            "project_id": project_id,
            "group_ids": list(group_ids),
            "datetime": datetime.now(tz=pytz.utc),
        }

        self._send(project_id, "start_delete_groups", extra_data=(state,), asynchronous=False)

        return state

    def end_delete_groups(self, state):
        state = state.copy()
        state["datetime"] = datetime.now(tz=pytz.utc)
        self._send(
            state["project_id"], "end_delete_groups", extra_data=(state,), asynchronous=False
        )

    def start_merge(self, project_id, previous_group_ids, new_group_id):
        if not previous_group_ids:
            return

        state = {
            "transaction_id": uuid4().hex,
            "project_id": project_id,
            "previous_group_ids": list(previous_group_ids),
            "new_group_id": new_group_id,
            "datetime": datetime.now(tz=pytz.utc),
        }

        self._send(project_id, "start_merge", extra_data=(state,), asynchronous=False)

        return state

    def end_merge(self, state):
        state = state.copy()
        state["datetime"] = datetime.now(tz=pytz.utc)
        self._send(state["project_id"], "end_merge", extra_data=(state,), asynchronous=False)

    def start_unmerge(self, project_id, hashes, previous_group_id, new_group_id):
        if not hashes:
            return

        state = {
            "transaction_id": uuid4().hex,
            "project_id": project_id,
            "previous_group_id": previous_group_id,
            "new_group_id": new_group_id,
            "hashes": list(hashes),
            "datetime": datetime.now(tz=pytz.utc),
        }

        self._send(project_id, "start_unmerge", extra_data=(state,), asynchronous=False)

        return state

    def end_unmerge(self, state):
        state = state.copy()
        state["datetime"] = datetime.now(tz=pytz.utc)
        self._send(state["project_id"], "end_unmerge", extra_data=(state,), asynchronous=False)

    def start_delete_tag(self, project_id, tag):
        if not tag:
            return

        state = {
            "transaction_id": uuid4().hex,
            "project_id": project_id,
            "tag": tag,
            "datetime": datetime.now(tz=pytz.utc),
        }

        self._send(project_id, "start_delete_tag", extra_data=(state,), asynchronous=False)

        return state

    def end_delete_tag(self, state):
        state = state.copy()
        state["datetime"] = datetime.now(tz=pytz.utc)
        self._send(state["project_id"], "end_delete_tag", extra_data=(state,), asynchronous=False)

    def _send(
        self,
        project_id,
        _type,
        extra_data=(),
        asynchronous=True,
        headers=None,  # Optional[Mapping[str, str]]
    ):
        raise NotImplementedError


class SnubaEventStream(SnubaProtocolEventStream):
    def _send(
        self,
        project_id,
        _type,
        extra_data=(),
        asynchronous=True,
        headers=None,  # Optional[Mapping[str, str]]
    ):
        if headers is None:
            headers = {}

        data = (self.EVENT_PROTOCOL_VERSION, _type) + extra_data

        # TODO remove this once the unified dataset is available.
        # Inserting into both events and transactions datasets lets us
        # simulate what is currently happening via kafka when both the events
        # and transactions consumers are running.
        datasets = ["events"]
        if get_path(extra_data, 0, "data", "type") == "transaction":
            datasets.append("transactions")
        try:
            for dataset in datasets:
                resp = snuba._snuba_pool.urlopen(
                    "POST",
                    "/tests/{}/eventstream".format(dataset),
                    body=json.dumps(data),
                    headers={"X-Sentry-{}".format(k): v for k, v in headers.items()},
                )
                if resp.status != 200:
                    raise snuba.SnubaError("HTTP %s response from Snuba!" % resp.status)
            return resp
        except urllib3.exceptions.HTTPError as err:
            raise snuba.SnubaError(err)

    def requires_post_process_forwarder(self):
        return False

    def insert(
        self,
        group,
        event,
        is_new,
        is_regression,
        is_new_group_environment,
        primary_hash,
        received_timestamp,  # type: float
        skip_consume=False,
    ):
        super(SnubaEventStream, self).insert(
            group,
            event,
            is_new,
            is_regression,
            is_new_group_environment,
            primary_hash,
            received_timestamp,
            skip_consume,
        )
        self._dispatch_post_process_group_task(
            event, is_new, is_regression, is_new_group_environment, primary_hash, skip_consume
        )
