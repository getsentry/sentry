from __future__ import absolute_import

import pytz

from datetime import datetime
from dateutil.parser import parse as parse_date

from sentry.models import EventCommon, EventDict
from sentry.db.models import NodeData

from sentry.snuba.events import Columns


def ref_func(x):
    return x.project_id or x.project.id


class Event(EventCommon):
    def __init__(
        self, project_id, event_id, group_id=None, message=None, data=None, snuba_data=None
    ):
        self.project_id = project_id
        self.event_id = event_id
        self.group_id = group_id
        self.message = message
        self.data = data
        self._snuba_data = snuba_data or {}
        super(Event, self).__init__()

    def __getstate__(self):
        state = self.__dict__.copy()
        # do not pickle cached info.  We want to fetch this on demand
        # again.  In particular if we were to pickle interfaces we would
        # pickle a CanonicalKeyView which old sentry workers do not know
        # about
        state.pop("_project_cache", None)
        state.pop("_environment_cache", None)
        state.pop("_group_cache", None)
        state.pop("interfaces", None)

        return state

    @property
    def data(self):
        return self._data

    @data.setter
    def data(self, value):
        node_id = Event.generate_node_id(self.project_id, self.event_id)
        self._data = NodeData(
            node_id, data=value, wrapper=EventDict, ref_version=2, ref_func=ref_func
        )

    @property
    def group_id(self):
        if self._group_id:
            return self._group_id

        column = self.__get_column_name(Columns.GROUP_ID)

        return self._snuba_data.get(column)

    @group_id.setter
    def group_id(self, value):
        self._group_id = value

    @property
    def platform(self):
        column = self.__get_column_name(Columns.PLATFORM)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return self.data.get("platform", None)

    @property
    def message(self):
        if self._message:
            return self._message

        column = self.__get_column_name(Columns.MESSAGE)
        if column in self._snuba_data:
            return self._snuba_data[column]

        return self.data.get("message")

    @message.setter
    def message(self, value):
        self._message = value

    @property
    def datetime(self):
        column = self.__get_column_name(Columns.TIMESTAMP)
        if column in self._snuba_data:
            return parse_date(self._snuba_data[column]).replace(tzinfo=pytz.utc)

        timestamp = self.data.get("timestamp")
        date = datetime.fromtimestamp(timestamp)
        date = date.replace(tzinfo=pytz.utc)
        return date

    @property
    def timestamp(self):
        column = self.__get_column_name(Columns.TIMESTAMP)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return self.datetime.isoformat()

    @property
    def id(self):
        return self.event_id

    # ============================================
    # Snuba-only implementations of properties that
    # would otherwise require nodestore data.
    # ============================================
    @property
    def tags(self):
        """
        Override of tags property that uses tags from snuba rather than
        the nodestore event body. This might be useful for implementing
        tag deletions without having to rewrite nodestore blobs.
        """
        tags_key_column = self.__get_column_name(Columns.TAGS_KEY)
        tags_value_column = self.__get_column_name(Columns.TAGS_VALUE)

        if tags_key_column in self._snuba_data and tags_value_column in self._snuba_data:
            keys = self._snuba_data[tags_key_column]
            values = self._snuba_data[tags_value_column]
            if keys and values and len(keys) == len(values):
                return sorted(zip(keys, values))
            else:
                return []
        else:
            return super(Event, self).tags

    def get_minimal_user(self):
        from sentry.interfaces.user import User

        user_id_column = self.__get_column_name(Columns.USER_ID)
        user_email_column = self.__get_column_name(Columns.USER_EMAIL)
        user_username_column = self.__get_column_name(Columns.USER_USERNAME)
        user_ip_address_column = self.__get_column_name(Columns.USER_IP_ADDRESS)

        if all(
            key in self._snuba_data
            for key in [
                user_id_column,
                user_email_column,
                user_username_column,
                user_ip_address_column,
            ]
        ):
            user_id = self._snuba_data[user_id_column]
            email = self._snuba_data[user_email_column]
            username = self._snuba_data[user_username_column]
            ip_address = self._snuba_data[user_ip_address_column]

            return User.to_python(
                {"id": user_id, "email": email, "username": username, "ip_address": ip_address}
            )

        return super(Event, self).get_minimal_user()

    # If the data for these is available from snuba, we assume
    # it was already normalized on the way in and we can just return
    # it, otherwise we defer to EventCommon implementation.
    def get_event_type(self):
        column = self.__get_column_name(Columns.TYPE)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return super(Event, self).get_event_type()

    @property
    def ip_address(self):
        column = self.__get_column_name(Columns.USER_IP_ADDRESS)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return super(Event, self).ip_address

    @property
    def title(self):
        column = self.__get_column_name(Columns.TITLE)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return super(Event, self).title

    @property
    def culprit(self):
        column = self.__get_column_name(Columns.CULPRIT)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return super(Event, self).culprit

    @property
    def location(self):
        column = self.__get_column_name(Columns.LOCATION)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return super(Event, self).location

    def __get_column_name(self, column):
        # Events are currently populated from the Events dataset
        return column.value.event_name
