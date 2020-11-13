from __future__ import absolute_import

import pytz
import six
import string

from collections import OrderedDict
from datetime import datetime
from dateutil.parser import parse as parse_date
from django.conf import settings
from django.utils.encoding import force_text
from hashlib import md5

from sentry import eventtypes
from sentry.interfaces.base import get_interfaces
from sentry.models import EventDict
from sentry.db.models import NodeData
from sentry.snuba.events import Columns
from sentry.utils import json
from sentry.utils.cache import memoize
from sentry.utils.canonical import CanonicalKeyView
from sentry.utils.safe import get_path, trim
from sentry.utils.strings import truncatechars
from sentry.utils.compat import zip


# Keys in the event payload we do not want to send to the event stream / snuba.
EVENTSTREAM_PRUNED_KEYS = ("debug_meta", "_meta")


def ref_func(x):
    return x.project_id or x.project.id


class Event(object):
    """
    Event backed by nodestore and Snuba.
    """

    def __init__(self, project_id, event_id, group_id=None, data=None, snuba_data=None):
        self.project_id = project_id
        self.event_id = event_id
        self.group_id = group_id
        self.data = data
        self._snuba_data = snuba_data or {}

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
        return (
            get_path(self.data, "logentry", "formatted")
            or get_path(self.data, "logentry", "message")
            or ""
        )

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
    def tags(self):
        """
        Tags property uses tags from snuba if loaded otherwise falls back to
        nodestore.
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
        # Nodestore implementation
        try:
            rv = sorted(
                [
                    (t, v)
                    for t, v in get_path(self.data, "tags", filter=True) or ()
                    if t is not None and v is not None
                ]
            )
            return rv
        except ValueError:
            # at one point Sentry allowed invalid tag sets such as (foo, bar)
            # vs ((tag, foo), (tag, bar))
            return []

    def get_tag(self, key):
        for t, v in self.tags:
            if t == key:
                return v
        return None

    @property
    def release(self):
        return self.get_tag("sentry:release")

    @property
    def dist(self):
        return self.get_tag("sentry:dist")

    @property
    def transaction(self):
        return self.get_tag("transaction")

    def get_environment(self):
        from sentry.models import Environment

        if not hasattr(self, "_environment_cache"):
            self._environment_cache = Environment.objects.get(
                organization_id=self.project.organization_id,
                name=Environment.get_name_or_default(self.get_tag("environment")),
            )

        return self._environment_cache

    def get_minimal_user(self):
        """
        A minimal 'User' interface object that gives us enough information
        to render a user badge.
        """
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

        return self.get_interface("user")

    def get_event_type(self):
        """
        Return the type of this event.

        See ``sentry.eventtypes``.
        """
        column = self.__get_column_name(Columns.TYPE)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return self.data.get("type", "default")

    @property
    def ip_address(self):
        column = self.__get_column_name(Columns.USER_IP_ADDRESS)
        if column in self._snuba_data:
            return self._snuba_data[column]

        ip_address = get_path(self.data, "user", "ip_address")
        if ip_address:
            return ip_address

        remote_addr = get_path(self.data, "request", "env", "REMOTE_ADDR")
        if remote_addr:
            return remote_addr

        return None

    @property
    def title(self):
        column = self.__get_column_name(Columns.TITLE)
        if column in self._snuba_data:
            return self._snuba_data[column]

        et = eventtypes.get(self.get_event_type())()
        return et.get_title(self.get_event_metadata())

    @property
    def culprit(self):
        column = self.__get_column_name(Columns.CULPRIT)
        if column in self._snuba_data:
            return self._snuba_data[column]
        return self.data.get("culprit")

    @property
    def location(self):
        column = self.__get_column_name(Columns.LOCATION)
        if column in self._snuba_data:
            return self._snuba_data[column]
        et = eventtypes.get(self.get_event_type())()
        return et.get_location(self.get_event_metadata())

    @classmethod
    def generate_node_id(cls, project_id, event_id):
        """
        Returns a deterministic node_id for this event based on the project_id
        and event_id which together are globally unique. The event body should
        be saved under this key in nodestore so it can be retrieved using the
        same generated id when we only have project_id and event_id.
        """
        return md5(u"{}:{}".format(project_id, event_id).encode("utf-8")).hexdigest()

    # TODO We need a better way to cache these properties.  functools32
    # doesn't quite do the trick as there is a reference bug with unsaved
    # models. But the current _group_cache thing is also clunky because these
    # properties need to be stripped out in __getstate__.
    @property
    def group(self):
        from sentry.models import Group

        if not self.group_id:
            return None
        if not hasattr(self, "_group_cache"):
            self._group_cache = Group.objects.get(id=self.group_id)
        return self._group_cache

    @group.setter
    def group(self, group):
        self.group_id = group.id
        self._group_cache = group

    @property
    def project(self):
        from sentry.models import Project

        if not hasattr(self, "_project_cache"):
            self._project_cache = Project.objects.get(id=self.project_id)
        return self._project_cache

    @project.setter
    def project(self, project):
        if project is None:
            self.project_id = None
        else:
            self.project_id = project.id
        self._project_cache = project

    def get_interfaces(self):
        return CanonicalKeyView(get_interfaces(self.data))

    @memoize
    def interfaces(self):
        return self.get_interfaces()

    def get_interface(self, name):
        return self.interfaces.get(name)

    def get_event_metadata(self):
        """
        Return the metadata of this event.

        See ``sentry.eventtypes``.
        """
        # For some inexplicable reason we have some cases where the data
        # is completely empty.  In that case we want to hobble along
        # further.
        return self.data.get("metadata") or {}

    def get_grouping_config(self):
        """Returns the event grouping config."""
        from sentry.grouping.api import get_grouping_config_dict_for_event_data

        return get_grouping_config_dict_for_event_data(self.data, self.project)

    def get_hashes(self, force_config=None):
        """
        Returns the calculated hashes for the event.  This uses the stored
        information if available.  Grouping hashes will take into account
        fingerprinting and checksums.
        """
        # If we have hashes stored in the data we use them, otherwise we
        # fall back to generating new ones from the data.  We can only use
        # this if we do not force a different config.
        if force_config is None:
            hashes = self.data.get("hashes")
            if hashes is not None:
                return hashes

        return [
            _f
            for _f in [x.get_hash() for x in self.get_grouping_variants(force_config).values()]
            if _f
        ]

    def get_grouping_variants(self, force_config=None, normalize_stacktraces=False):
        """
        This is similar to `get_hashes` but will instead return the
        grouping components for each variant in a dictionary.

        If `normalize_stacktraces` is set to `True` then the event data will be
        modified for `in_app` in addition to event variants being created.  This
        means that after calling that function the event data has been modified
        in place.
        """
        from sentry.grouping.api import get_grouping_variants_for_event, load_grouping_config
        from sentry.stacktraces.processing import normalize_stacktraces_for_grouping

        # Forcing configs has two separate modes.  One is where just the
        # config ID is given in which case it's merged with the stored or
        # default config dictionary
        if force_config is not None:
            if isinstance(force_config, six.string_types):
                stored_config = self.get_grouping_config()
                config = dict(stored_config)
                config["id"] = force_config
            else:
                config = force_config

        # Otherwise we just use the same grouping config as stored.  if
        # this is None the `get_grouping_variants_for_event` will fill in
        # the default.
        else:
            config = self.data.get("grouping_config")

        config = load_grouping_config(config)
        if normalize_stacktraces:
            normalize_stacktraces_for_grouping(self.data, config)

        return get_grouping_variants_for_event(self, config)

    def get_primary_hash(self):
        # TODO: This *might* need to be protected from an IndexError?
        return self.get_hashes()[0]

    @property
    def organization(self):
        return self.project.organization

    @property
    def version(self):
        return self.data.get("version", "5")

    def get_raw_data(self, for_stream=False):
        """Returns the internal raw event data dict."""
        rv = dict(self.data.items())
        # If we get raw data for snuba we remove some large keys that blow
        # up the payload for no reason.
        if for_stream:
            for key in EVENTSTREAM_PRUNED_KEYS:
                rv.pop(key, None)
        return rv

    @property
    def size(self):
        return len(json.dumps(dict(self.data)))

    def get_email_subject(self):
        template = self.project.get_option("mail:subject_template")
        if template:
            template = EventSubjectTemplate(template)
        else:
            template = DEFAULT_SUBJECT_TEMPLATE
        return truncatechars(template.safe_substitute(EventSubjectTemplateData(self)), 128)

    def as_dict(self):
        """Returns the data in normalized form for external consumers."""
        # We use a OrderedDict to keep elements ordered for a potential JSON serializer
        data = OrderedDict()
        data["event_id"] = self.event_id
        data["project"] = self.project_id
        data["release"] = self.release
        data["dist"] = self.dist
        data["platform"] = self.platform
        data["message"] = self.message
        data["datetime"] = self.datetime
        data["tags"] = [(k.split("sentry:", 1)[-1], v) for (k, v) in self.tags]
        for k, v in sorted(six.iteritems(self.data)):
            if k in data:
                continue
            if k == "sdk":
                v = {v_k: v_v for v_k, v_v in six.iteritems(v) if v_k != "client_ip"}
            data[k] = v

        # for a long time culprit was not persisted.  In those cases put
        # the culprit in from the group.
        if data.get("culprit") is None and self.group_id:
            data["culprit"] = self.group.culprit

        # Override title and location with dynamically generated data
        data["title"] = self.title
        data["location"] = self.location

        return data

    @memoize
    def search_message(self):
        """
        The internal search_message attribute is only used for search purposes.
        It adds a bunch of data from the metadata and the culprit.
        """
        data = self.data
        culprit = self.culprit

        event_metadata = self.get_event_metadata()

        if event_metadata is None:
            event_metadata = eventtypes.get(self.get_event_type())().get_metadata(self.data)

        message = ""

        if data.get("logentry"):
            message += data["logentry"].get("formatted") or data["logentry"].get("message") or ""

        if event_metadata:
            for value in six.itervalues(event_metadata):
                value_u = force_text(value, errors="replace")
                if value_u not in message:
                    message = u"{} {}".format(message, value_u)

        if culprit and culprit not in message:
            culprit_u = force_text(culprit, errors="replace")
            message = u"{} {}".format(message, culprit_u)

        return trim(message.strip(), settings.SENTRY_MAX_MESSAGE_LENGTH)

    def __get_column_name(self, column):
        # Events are currently populated from the Events dataset
        return column.value.event_name


class EventSubjectTemplate(string.Template):
    idpattern = r"(tag:)?[_a-z][_a-z0-9]*"


class EventSubjectTemplateData(object):
    tag_aliases = {"release": "sentry:release", "dist": "sentry:dist", "user": "sentry:user"}

    def __init__(self, event):
        self.event = event

    def __getitem__(self, name):
        if name.startswith("tag:"):
            name = name[4:]
            value = self.event.get_tag(self.tag_aliases.get(name, name))
            if value is None:
                raise KeyError
            return six.text_type(value)
        elif name == "project":
            return self.event.project.get_full_name()
        elif name == "projectID":
            return self.event.project.slug
        elif name == "shortID" and self.event.group_id:
            return self.event.group.qualified_short_id
        elif name == "orgID":
            return self.event.organization.slug
        elif name == "title":
            return self.event.title
        raise KeyError


DEFAULT_SUBJECT_TEMPLATE = EventSubjectTemplate("$shortID - $title")
