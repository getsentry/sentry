from __future__ import absolute_import

import six
import string

from collections import OrderedDict
from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from hashlib import md5

from semaphore.processing import StoreNormalizer

from sentry import eventtypes, nodestore
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedIntegerField,
    Model,
    NodeData,
    NodeField,
    sane_repr,
)
from sentry.db.models.manager import BaseManager
from sentry.interfaces.base import get_interfaces
from sentry.utils import json
from sentry.utils.cache import memoize
from sentry.utils.canonical import CanonicalKeyDict, CanonicalKeyView
from sentry.utils.safe import get_path
from sentry.utils.strings import truncatechars


class EventDict(CanonicalKeyDict):
    """
    Creating an instance of this dictionary will send the event through basic
    (Rust-based) type/schema validation called "re-normalization".

    This is used as a wrapper type for `Event.data` such that creating an event
    object (or loading it from the DB) will ensure the data fits the type
    schema.
    """

    def __init__(self, data, skip_renormalization=False, **kwargs):
        is_renormalized = isinstance(data, EventDict) or (
            isinstance(data, NodeData) and isinstance(data.data, EventDict)
        )

        if not skip_renormalization and not is_renormalized:
            normalizer = StoreNormalizer(is_renormalize=True, enable_trimming=False)
            data = normalizer.normalize_event(dict(data))

        CanonicalKeyDict.__init__(self, data, **kwargs)


class EventCommon(object):
    @classmethod
    def generate_node_id(cls, project_id, event_id):
        """
        Returns a deterministic node_id for this event based on the project_id
        and event_id which together are globally unique. The event body should
        be saved under this key in nodestore so it can be retrieved using the
        same generated id when we only have project_id and event_id.
        """
        return md5("{}:{}".format(project_id, event_id)).hexdigest()

    # TODO (alex) We need a better way to cache these properties.  functools32
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
        # guard against None to not fail on AttributeError
        # otherwise Django 1.10 will swallow it in db.models.base init, but
        # consequently fail to remove from kwargs, and you'll get the red herring
        # TypeError: 'group' is an invalid keyword argument for this function.
        if group is not None:
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

    def get_legacy_message(self):
        # TODO: This is only used in the pagerduty plugin. We should use event.title
        # there and remove this function once users have been notified, since PD
        # alert routing may be based off the message field.
        return (
            get_path(self.data, "logentry", "formatted")
            or get_path(self.data, "logentry", "message")
            or self.message
        )

    def get_event_type(self):
        """
        Return the type of this event.

        See ``sentry.eventtypes``.
        """
        return self.data.get("type", "default")

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

        return filter(
            None, [x.get_hash() for x in self.get_grouping_variants(force_config).values()]
        )

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
    def title(self):
        # also see event_manager.py which inserts this for snuba
        et = eventtypes.get(self.get_event_type())()
        return et.get_title(self.get_event_metadata())

    @property
    def culprit(self):
        return self.data.get("culprit")

    @property
    def location(self):
        # also see event_manager.py which inserts this for snuba
        et = eventtypes.get(self.get_event_type())()
        return et.get_location(self.get_event_metadata())

    @property
    def real_message(self):
        # XXX(mitsuhiko): this is a transitional attribute that should be
        # removed.  `message` will be renamed to `search_message` and this
        # will become `message`.
        return (
            get_path(self.data, "logentry", "formatted")
            or get_path(self.data, "logentry", "message")
            or ""
        )

    @property
    def organization(self):
        return self.project.organization

    @property
    def version(self):
        return self.data.get("version", "5")

    @property
    def ip_address(self):
        ip_address = get_path(self.data, "user", "ip_address")
        if ip_address:
            return ip_address

        remote_addr = get_path(self.data, "request", "env", "REMOTE_ADDR")
        if remote_addr:
            return remote_addr

        return None

    @property
    def tags(self):
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

    def get_raw_data(self):
        """Returns the internal raw event data dict."""
        return dict(self.data.items())

    @property
    def size(self):
        return len(json.dumps(dict(self.data)))

    @property
    def transaction(self):
        return self.get_tag("transaction")

    def get_email_subject(self):
        template = self.project.get_option("mail:subject_template")
        if template:
            template = EventSubjectTemplate(template)
        else:
            template = DEFAULT_SUBJECT_TEMPLATE
        return truncatechars(template.safe_substitute(EventSubjectTemplateData(self)), 128).encode(
            "utf-8"
        )

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
        return self.get_interface("user")

    def as_dict(self):
        """Returns the data in normalized form for external consumers."""
        # We use a OrderedDict to keep elements ordered for a potential JSON serializer
        data = OrderedDict()
        data["event_id"] = self.event_id
        data["project"] = self.project_id
        data["release"] = self.release
        data["dist"] = self.dist
        data["platform"] = self.platform
        data["message"] = self.real_message
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

    def bind_node_data(self):
        node_id = Event.generate_node_id(self.project_id, self.event_id)
        node_data = nodestore.get(node_id) or {}
        ref = self.data.get_ref(self)
        self.data.bind_data(node_data, ref=ref)


def ref_func(x):
    return x.project_id or x.project.id


class Event(EventCommon, Model):
    """
    An event backed by data stored in postgres.

    """

    __core__ = False

    group_id = BoundedBigIntegerField(blank=True, null=True)
    event_id = models.CharField(max_length=32, null=True, db_column="message_id")
    project_id = BoundedBigIntegerField(blank=True, null=True)
    message = models.TextField()
    platform = models.CharField(max_length=64, null=True)
    datetime = models.DateTimeField(default=timezone.now, db_index=True)
    time_spent = BoundedIntegerField(null=True)
    data = NodeField(
        blank=True,
        null=True,
        ref_func=ref_func,
        ref_version=2,
        wrapper=EventDict,
        skip_nodestore_save=True,
    )

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_message"
        verbose_name = _("message")
        verbose_name_plural = _("messages")
        unique_together = (("project_id", "event_id"),)
        index_together = (("group_id", "datetime"),)

    __repr__ = sane_repr("project_id", "group_id")

    def __getstate__(self):
        state = Model.__getstate__(self)

        # do not pickle cached info.  We want to fetch this on demand
        # again.  In particular if we were to pickle interfaces we would
        # pickle a CanonicalKeyView which old sentry workers do not know
        # about
        state.pop("_project_cache", None)
        state.pop("_environment_cache", None)
        state.pop("_group_cache", None)
        state.pop("interfaces", None)

        return state


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
