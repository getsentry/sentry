from __future__ import absolute_import, print_function

import logging
import time

import ipaddress
import jsonschema
import six

from datetime import datetime, timedelta
from django.conf import settings
from django.core.cache import cache
from django.db import connection, IntegrityError, router, transaction
from django.db.models import Func
from django.utils import timezone
from django.utils.encoding import force_text

from sentry import buffer, eventstore, eventtypes, eventstream, options, tsdb
from sentry.constants import (
    DEFAULT_STORE_NORMALIZER_ARGS,
    LOG_LEVELS,
    LOG_LEVELS_MAP,
    MAX_TAG_VALUE_LENGTH,
    MAX_SECS_IN_FUTURE,
    MAX_SECS_IN_PAST,
)
from sentry.message_filters import should_filter_event
from sentry.grouping.api import (
    get_grouping_config_dict_for_project,
    get_grouping_config_dict_for_event_data,
    load_grouping_config,
    apply_server_fingerprinting,
    get_fingerprinting_config_for_project,
    GroupingConfigNotFound,
)
from sentry.coreapi import (
    APIError,
    APIForbidden,
    decompress_gzip,
    decompress_deflate,
    decode_and_decompress_data,
    decode_data,
    safely_load_json_string,
)
from sentry.interfaces.base import get_interface
from sentry.models import (
    Activity,
    Environment,
    Event,
    EventDict,
    EventError,
    EventUser,
    Group,
    GroupEnvironment,
    GroupHash,
    GroupLink,
    GroupRelease,
    GroupResolution,
    GroupStatus,
    Project,
    Release,
    ReleaseEnvironment,
    ReleaseProject,
    ReleaseProjectEnvironment,
    UserReport,
    Organization,
)
from sentry.plugins.base import plugins
from sentry.signals import event_discarded, event_saved, first_event_received
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.utils import metrics
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.data_filters import (
    is_valid_ip,
    is_valid_release,
    is_valid_error_message,
    FilterStatKeys,
)
from sentry.utils.dates import to_timestamp
from sentry.utils.safe import safe_execute, trim, get_path, setdefault_path
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.culprit import generate_culprit

logger = logging.getLogger("sentry.events")

SECURITY_REPORT_INTERFACES = ("csp", "hpkp", "expectct", "expectstaple")


def pop_tag(data, key):
    data["tags"] = [kv for kv in data["tags"] if kv is None or kv[0] != key]


def set_tag(data, key, value):
    pop_tag(data, key)
    data["tags"].append((key, trim(value, MAX_TAG_VALUE_LENGTH)))


def get_tag(data, key):
    for k, v in get_path(data, "tags", filter=True):
        if k == key:
            return v


def validate_and_set_timestamp(data, timestamp):
    """
    Helper function for event processors/enhancers to avoid setting broken timestamps.

    If we set a too old or too new timestamp then this affects event retention
    and search.
    """
    # XXX(markus): We should figure out if we could run normalization
    # after event processing again. Right now we duplicate code between here
    # and event normalization
    if timestamp:
        current = time.time()

        if current - MAX_SECS_IN_PAST > timestamp:
            data.setdefault("errors", []).append(
                {"type": EventError.PAST_TIMESTAMP, "name": "timestamp", "value": timestamp}
            )
        elif timestamp > current + MAX_SECS_IN_FUTURE:
            data.setdefault("errors", []).append(
                {"type": EventError.FUTURE_TIMESTAMP, "name": "timestamp", "value": timestamp}
            )
        else:
            data["timestamp"] = float(timestamp)


def parse_client_as_sdk(value):
    if not value:
        return {}
    try:
        name, version = value.split("/", 1)
    except ValueError:
        try:
            name, version = value.split(" ", 1)
        except ValueError:
            return {}
    return {"name": name, "version": version}


def plugin_is_regression(group, event):
    project = event.project
    for plugin in plugins.for_project(project):
        result = safe_execute(
            plugin.is_regression, group, event, version=1, _with_transaction=False
        )
        if result is not None:
            return result
    return True


def has_pending_commit_resolution(group):
    return (
        GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )
        .extra(
            where=[
                "NOT EXISTS(SELECT 1 FROM sentry_releasecommit where commit_id = sentry_grouplink.linked_id)"
            ]
        )
        .exists()
    )


class HashDiscarded(Exception):
    pass


class ScoreClause(Func):
    def __init__(self, group=None, last_seen=None, times_seen=None, *args, **kwargs):
        self.group = group
        self.last_seen = last_seen
        self.times_seen = times_seen
        # times_seen is likely an F-object that needs the value extracted
        if hasattr(self.times_seen, "rhs"):
            self.times_seen = self.times_seen.rhs.value
        super(ScoreClause, self).__init__(*args, **kwargs)

    def __int__(self):
        # Calculate the score manually when coercing to an int.
        # This is used within create_or_update and friends
        return self.group.get_score() if self.group else 0

    def as_sql(self, compiler, connection, function=None, template=None):
        has_values = self.last_seen is not None and self.times_seen is not None
        if has_values:
            sql = "log(times_seen + %d) * 600 + %d" % (
                self.times_seen,
                to_timestamp(self.last_seen),
            )
        else:
            sql = "log(times_seen) * 600 + last_seen::abstime::int"

        return (sql, [])


def add_meta_errors(errors, meta):
    for field_meta in meta:
        original_value = field_meta.get().get("val")

        for i, (err_type, err_data) in enumerate(field_meta.iter_errors()):
            error = dict(err_data)
            error["type"] = err_type
            if field_meta.path:
                error["name"] = field_meta.path
            if i == 0 and original_value is not None:
                error["value"] = original_value
            errors.append(error)


def _decode_event(data, content_encoding):
    if isinstance(data, six.binary_type):
        if content_encoding == "gzip":
            data = decompress_gzip(data)
        elif content_encoding == "deflate":
            data = decompress_deflate(data)
        elif data[0] != b"{":
            data = decode_and_decompress_data(data)
        else:
            data = decode_data(data)
    if isinstance(data, six.text_type):
        data = safely_load_json_string(data)

    return CanonicalKeyDict(data)


class EventManager(object):
    """
    Handles normalization in both the store endpoint and the save task. The
    intention is to swap this class out with a reimplementation in Rust.
    """

    def __init__(
        self,
        data,
        version="5",
        project=None,
        grouping_config=None,
        client_ip=None,
        user_agent=None,
        auth=None,
        key=None,
        content_encoding=None,
        is_renormalize=False,
        remove_other=None,
        project_config=None,
    ):
        self._data = _decode_event(data, content_encoding=content_encoding)
        self.version = version
        self._project = project
        # if not explicitly specified try to get the grouping from project_config
        if grouping_config is None and project_config is not None:
            config = project_config.config
            grouping_config = config.get("grouping_config")
        # if we still don't have a grouping also try the project
        if grouping_config is None and project is not None:
            grouping_config = get_grouping_config_dict_for_project(self._project)
        self._grouping_config = grouping_config
        self._client_ip = client_ip
        self._user_agent = user_agent
        self._auth = auth
        self._key = key
        self._is_renormalize = is_renormalize
        self._remove_other = remove_other
        self._normalized = False
        self.project_config = project_config

    def process_csp_report(self):
        """Only called from the CSP report endpoint."""
        data = self._data

        try:
            interface = get_interface(data.pop("interface"))
            report = data.pop("report")
        except KeyError:
            raise APIForbidden("No report or interface data")

        # To support testing, we can either accept a built interface instance, or the raw data in
        # which case we build the instance ourselves
        try:
            instance = report if isinstance(report, interface) else interface.from_raw(report)
        except jsonschema.ValidationError as e:
            raise APIError("Invalid security report: %s" % str(e).splitlines()[0])

        def clean(d):
            return dict(filter(lambda x: x[1], d.items()))

        data.update(
            {
                "logger": "csp",
                "message": instance.get_message(),
                "culprit": instance.get_culprit(),
                instance.path: instance.to_json(),
                "tags": instance.get_tags(),
                "errors": [],
                "user": {"ip_address": self._client_ip},
                # Construct a faux Http interface based on the little information we have
                # This is a bit weird, since we don't have nearly enough
                # information to create an Http interface, but
                # this automatically will pick up tags for the User-Agent
                # which is actually important here for CSP
                "request": {
                    "url": instance.get_origin(),
                    "headers": clean(
                        {"User-Agent": self._user_agent, "Referer": instance.get_referrer()}
                    ),
                },
            }
        )

        self._data = data

    def normalize(self):
        with metrics.timer("events.store.normalize.duration"):
            self._normalize_impl()

    def _normalize_impl(self):
        if self._normalized:
            raise RuntimeError("Already normalized")
        self._normalized = True

        from semaphore.processing import StoreNormalizer

        rust_normalizer = StoreNormalizer(
            project_id=self._project.id if self._project else None,
            client_ip=self._client_ip,
            client=self._auth.client if self._auth else None,
            key_id=six.text_type(self._key.id) if self._key else None,
            grouping_config=self._grouping_config,
            protocol_version=six.text_type(self.version) if self.version is not None else None,
            is_renormalize=self._is_renormalize,
            remove_other=self._remove_other,
            normalize_user_agent=True,
            **DEFAULT_STORE_NORMALIZER_ARGS
        )

        self._data = CanonicalKeyDict(rust_normalizer.normalize_event(dict(self._data)))

    def should_filter(self):
        """
        returns (result: bool, reason: string or None)
        Result is True if an event should be filtered
        The reason for filtering is passed along as a string
        so that we can store it in metrics
        """
        for name in SECURITY_REPORT_INTERFACES:
            if name in self._data:
                interface = get_interface(name)
                if interface.to_python(self._data[name]).should_filter(self._project):
                    return (True, FilterStatKeys.INVALID_CSP)

        if self._client_ip and not is_valid_ip(self.project_config, self._client_ip):
            return (True, FilterStatKeys.IP_ADDRESS)

        release = self._data.get("release")
        if release and not is_valid_release(self.project_config, release):
            return (True, FilterStatKeys.RELEASE_VERSION)

        error_message = (
            get_path(self._data, "logentry", "formatted")
            or get_path(self._data, "logentry", "message")
            or ""
        )
        if error_message and not is_valid_error_message(self.project_config, error_message):
            return (True, FilterStatKeys.ERROR_MESSAGE)

        for exc in get_path(self._data, "exception", "values", filter=True, default=[]):
            message = u": ".join(filter(None, map(exc.get, ["type", "value"])))
            if message and not is_valid_error_message(self.project_config, message):
                return (True, FilterStatKeys.ERROR_MESSAGE)

        return should_filter_event(self.project_config, self._data)

    def get_data(self):
        return self._data

    def _get_event_instance(self, project_id=None):
        if options.get("store.use-django-event"):
            data = self._data
            event_id = data.get("event_id")
            platform = data.get("platform")

            recorded_timestamp = data.get("timestamp")
            date = datetime.fromtimestamp(recorded_timestamp)
            date = date.replace(tzinfo=timezone.utc)
            time_spent = data.get("time_spent")

            data["node_id"] = Event.generate_node_id(project_id, event_id)

            return Event(
                project_id=project_id or self._project.id,
                event_id=event_id,
                data=EventDict(data, skip_renormalization=True),
                time_spent=time_spent,
                datetime=date,
                platform=platform,
            )
        else:
            data = self._data
            event_id = data.get("event_id")

            return eventstore.create_event(
                project_id=project_id or self._project.id,
                event_id=event_id,
                group_id=None,
                data=EventDict(data, skip_renormalization=True),
            )

    def get_culprit(self):
        """Helper to calculate the default culprit"""
        return force_text(
            self._data.get("culprit")
            or self._data.get("transaction")
            or generate_culprit(self._data)
            or ""
        )

    def get_event_type(self):
        """Returns the event type."""
        return eventtypes.get(self._data.get("type", "default"))()

    def materialize_metadata(self):
        """Returns the materialized metadata to be merged with group or
        event data.  This currently produces the keys `type`, `metadata`,
        `title` and `location`.  This should most likely also produce
        `culprit` here.
        """
        event_type = self.get_event_type()
        event_metadata = event_type.get_metadata(self._data)
        return {
            "type": event_type.key,
            "metadata": event_metadata,
            "title": event_type.get_title(event_metadata),
            "location": event_type.get_location(event_metadata),
        }

    def get_search_message(self, event_metadata=None, culprit=None):
        """This generates the internal event.message attribute which is used
        for search purposes.  It adds a bunch of data from the metadata and
        the culprit.
        """
        if event_metadata is None:
            event_metadata = self.get_event_type().get_metadata(self._data)
        if culprit is None:
            culprit = self.get_culprit()

        data = self._data
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

    def save(self, project_id, raw=False, assume_normalized=False):
        """
        We re-insert events with duplicate IDs into Snuba, which is responsible
        for deduplicating events. Since deduplication in Snuba is on the primary
        key (based on event ID, project ID and day), events with same IDs are only
        deduplicated if their timestamps fall on the same day. The latest event
        always wins and overwrites the value of events received earlier in that day.

        Since we increment counters and frequencies here before events get inserted
        to eventstream these numbers may be larger than the total number of
        events if we receive duplicate event IDs that fall on the same day
        (that do not hit cache first).
        """

        # Normalize if needed
        if not self._normalized:
            if not assume_normalized:
                self.normalize()
            self._normalized = True

        data = self._data

        project = Project.objects.get_from_cache(id=project_id)
        project._organization_cache = Organization.objects.get_from_cache(
            id=project.organization_id
        )

        # Pull out the culprit
        culprit = self.get_culprit()

        # Pull the toplevel data we're interested in
        level = data.get("level")

        # TODO(mitsuhiko): this code path should be gone by July 2018.
        # This is going to be fine because no code actually still depends
        # on integers here.  When we need an integer it will be converted
        # into one later.  Old workers used to send integers here.
        if level is not None and isinstance(level, six.integer_types):
            level = LOG_LEVELS[level]

        transaction_name = data.get("transaction")
        logger_name = data.get("logger")
        release = data.get("release")
        dist = data.get("dist")
        environment = data.get("environment")
        recorded_timestamp = data.get("timestamp")

        # We need to swap out the data with the one internal to the newly
        # created event object
        event = self._get_event_instance(project_id=project_id)
        self._data = data = event.data.data

        event._project_cache = project

        date = event.datetime
        platform = event.platform
        event_id = event.event_id

        if transaction_name:
            transaction_name = force_text(transaction_name)

        # Right now the event type is the signal to skip the group. This
        # is going to change a lot.
        if event.get_event_type() == "transaction":
            issueless_event = True
        else:
            issueless_event = False

        # Some of the data that are toplevel attributes are duplicated
        # into tags (logger, level, environment, transaction).  These are
        # different from legacy attributes which are normalized into tags
        # ahead of time (site, server_name).
        setdefault_path(data, "tags", value=[])
        set_tag(data, "level", level)
        if logger_name:
            set_tag(data, "logger", logger_name)
        if environment:
            set_tag(data, "environment", environment)
        if transaction_name:
            set_tag(data, "transaction", transaction_name)

        if release:
            # dont allow a conflicting 'release' tag
            pop_tag(data, "release")
            release = Release.get_or_create(project=project, version=release, date_added=date)
            set_tag(data, "sentry:release", release.version)

        if dist and release:
            dist = release.add_dist(dist, date)
            # dont allow a conflicting 'dist' tag
            pop_tag(data, "dist")
            set_tag(data, "sentry:dist", dist.name)
        else:
            dist = None

        event_user = self._get_event_user(project, data)
        if event_user:
            # dont allow a conflicting 'user' tag
            pop_tag(data, "user")
            set_tag(data, "sentry:user", event_user.tag_value)

        # At this point we want to normalize the in_app values in case the
        # clients did not set this appropriately so far.
        grouping_config = load_grouping_config(
            get_grouping_config_dict_for_event_data(data, project)
        )
        normalize_stacktraces_for_grouping(data, grouping_config)

        for plugin in plugins.for_project(project, version=None):
            added_tags = safe_execute(plugin.get_tags, event, _with_transaction=False)
            if added_tags:
                # plugins should not override user provided tags
                for key, value in added_tags:
                    if get_tag(data, key) is None:
                        set_tag(data, key, value)

        for path, iface in six.iteritems(event.interfaces):
            for k, v in iface.iter_tags():
                set_tag(data, k, v)
            # Get rid of ephemeral interface data
            if iface.ephemeral:
                data.pop(iface.path, None)

        # The active grouping config was put into the event in the
        # normalize step before.  We now also make sure that the
        # fingerprint was set to `'{{ default }}' just in case someone
        # removed it from the payload.  The call to get_hashes will then
        # look at `grouping_config` to pick the right parameters.
        data["fingerprint"] = data.get("fingerprint") or ["{{ default }}"]
        apply_server_fingerprinting(data, get_fingerprinting_config_for_project(project))

        # Here we try to use the grouping config that was requested in the
        # event.  If that config has since been deleted (because it was an
        # experimental grouping config) we fall back to the default.
        try:
            hashes = event.get_hashes()
        except GroupingConfigNotFound:
            data["grouping_config"] = get_grouping_config_dict_for_project(project)
            hashes = event.get_hashes()

        data["hashes"] = hashes

        # we want to freeze not just the metadata and type in but also the
        # derived attributes.  The reason for this is that we push this
        # data into kafka for snuba processing and our postprocessing
        # picks up the data right from the snuba topic.  For most usage
        # however the data is dynamically overridden by Event.title and
        # Event.location (See Event.as_dict)
        materialized_metadata = self.materialize_metadata()
        event_metadata = materialized_metadata["metadata"]
        data.update(materialized_metadata)
        data["culprit"] = culprit

        # index components into ``Event.message``
        # See GH-3248
        event.message = self.get_search_message(event_metadata, culprit)
        received_timestamp = event.data.get("received") or float(event.datetime.strftime("%s"))

        if not issueless_event:
            # The group gets the same metadata as the event when it's flushed but
            # additionally the `last_received` key is set.  This key is used by
            # _save_aggregate.
            group_metadata = dict(materialized_metadata)
            group_metadata["last_received"] = received_timestamp
            kwargs = {
                "platform": platform,
                "message": event.message,
                "culprit": culprit,
                "logger": logger_name,
                "level": LOG_LEVELS_MAP.get(level),
                "last_seen": date,
                "first_seen": date,
                "active_at": date,
                "data": group_metadata,
            }

            if release:
                kwargs["first_release"] = release

            try:
                group, is_new, is_regression = self._save_aggregate(
                    event=event, hashes=hashes, release=release, **kwargs
                )
            except HashDiscarded:
                event_discarded.send_robust(project=project, sender=EventManager)

                metrics.incr(
                    "events.discarded",
                    skip_internal=True,
                    tags={"organization_id": project.organization_id, "platform": platform},
                )
                raise
            else:
                event_saved.send_robust(project=project, event_size=event.size, sender=EventManager)
            event.group = group
        else:
            group = None
            is_new = False
            is_regression = False
            event_saved.send_robust(project=project, event_size=event.size, sender=EventManager)

        # store a reference to the group id to guarantee validation of isolation
        event.data.bind_ref(event)

        environment = Environment.get_or_create(project=project, name=environment)

        if group:
            group_environment, is_new_group_environment = GroupEnvironment.get_or_create(
                group_id=group.id,
                environment_id=environment.id,
                defaults={"first_release": release if release else None},
            )
        else:
            is_new_group_environment = False

        if release:
            ReleaseEnvironment.get_or_create(
                project=project, release=release, environment=environment, datetime=date
            )

            ReleaseProjectEnvironment.get_or_create(
                project=project, release=release, environment=environment, datetime=date
            )

            if group:
                grouprelease = GroupRelease.get_or_create(
                    group=group, release=release, environment=environment, datetime=date
                )

        counters = [(tsdb.models.project, project.id)]

        if group:
            counters.append((tsdb.models.group, group.id))

        if release:
            counters.append((tsdb.models.release, release.id))

        tsdb.incr_multi(counters, timestamp=event.datetime, environment_id=environment.id)

        frequencies = []

        if group:
            frequencies.append(
                (tsdb.models.frequent_environments_by_group, {group.id: {environment.id: 1}})
            )

            if release:
                frequencies.append(
                    (tsdb.models.frequent_releases_by_group, {group.id: {grouprelease.id: 1}})
                )
        if frequencies:
            tsdb.record_frequency_multi(frequencies, timestamp=event.datetime)

        if group:
            UserReport.objects.filter(project=project, event_id=event_id).update(
                group=group, environment=environment
            )

        # Write the event to Nodestore
        event.data.save()

        if event_user:
            counters = [
                (tsdb.models.users_affected_by_project, project.id, (event_user.tag_value,))
            ]

            if group:
                counters.append(
                    (tsdb.models.users_affected_by_group, group.id, (event_user.tag_value,))
                )

            tsdb.record_multi(counters, timestamp=event.datetime, environment_id=environment.id)

        if release:
            if is_new:
                buffer.incr(
                    ReleaseProject,
                    {"new_groups": 1},
                    {"release_id": release.id, "project_id": project.id},
                )
            if is_new_group_environment:
                buffer.incr(
                    ReleaseProjectEnvironment,
                    {"new_issues_count": 1},
                    {
                        "project_id": project.id,
                        "release_id": release.id,
                        "environment_id": environment.id,
                    },
                )

        if not raw:
            if not project.first_event:
                project.update(first_event=date)
                first_event_received.send_robust(project=project, event=event, sender=Project)

        eventstream.insert(
            group=group,
            event=event,
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            primary_hash=hashes[0],
            # We are choosing to skip consuming the event back
            # in the eventstream if it's flagged as raw.
            # This means that we want to publish the event
            # through the event stream, but we don't care
            # about post processing and handling the commit.
            skip_consume=raw,
        )

        metric_tags = {"from_relay": "_relay_processed" in self._data}

        metrics.timing("events.latency", received_timestamp - recorded_timestamp, tags=metric_tags)
        metrics.timing("events.size.data.post_save", event.size, tags=metric_tags)
        metrics.incr(
            "events.post_save.normalize.errors",
            amount=len(self._data.get("errors") or ()),
            tags=metric_tags,
        )

        return event

    def _get_event_user(self, project, data):
        user_data = data.get("user")
        if not user_data:
            return

        ip_address = user_data.get("ip_address")

        if ip_address:
            try:
                ipaddress.ip_address(six.text_type(ip_address))
            except ValueError:
                ip_address = None

        euser = EventUser(
            project_id=project.id,
            ident=user_data.get("id"),
            email=user_data.get("email"),
            username=user_data.get("username"),
            ip_address=ip_address,
            name=user_data.get("name"),
        )
        euser.set_hash()
        if not euser.hash:
            return

        cache_key = u"euserid:1:{}:{}".format(project.id, euser.hash)
        euser_id = cache.get(cache_key)
        if euser_id is None:
            try:
                with transaction.atomic(using=router.db_for_write(EventUser)):
                    euser.save()
            except IntegrityError:
                try:
                    euser = EventUser.objects.get(project_id=project.id, hash=euser.hash)
                except EventUser.DoesNotExist:
                    # why???
                    e_userid = -1
                else:
                    if euser.name != (user_data.get("name") or euser.name):
                        euser.update(name=user_data["name"])
                    e_userid = euser.id
                cache.set(cache_key, e_userid, 3600)
        return euser

    def _find_hashes(self, project, hash_list):
        return map(
            lambda hash: GroupHash.objects.get_or_create(project=project, hash=hash)[0], hash_list
        )

    def _save_aggregate(self, event, hashes, release, **kwargs):
        project = event.project

        # attempt to find a matching hash
        all_hashes = self._find_hashes(project, hashes)

        existing_group_id = None
        for h in all_hashes:
            if h.group_id is not None:
                existing_group_id = h.group_id
                break
            if h.group_tombstone_id is not None:
                raise HashDiscarded("Matches group tombstone %s" % h.group_tombstone_id)

        # XXX(dcramer): this has the opportunity to create duplicate groups
        # it should be resolved by the hash merging function later but this
        # should be better tested/reviewed
        if existing_group_id is None:
            # it's possible the release was deleted between
            # when we queried for the release and now, so
            # make sure it still exists
            first_release = kwargs.pop("first_release", None)

            with transaction.atomic():
                short_id = project.next_short_id()
                group, group_is_new = (
                    Group.objects.create(
                        project=project,
                        short_id=short_id,
                        first_release_id=Release.objects.filter(id=first_release.id)
                        .values_list("id", flat=True)
                        .first()
                        if first_release
                        else None,
                        **kwargs
                    ),
                    True,
                )

            metrics.incr(
                "group.created", skip_internal=True, tags={"platform": event.platform or "unknown"}
            )

        else:
            group = Group.objects.get(id=existing_group_id)

            group_is_new = False

        group._project_cache = project

        # If all hashes are brand new we treat this event as new
        is_new = False
        new_hashes = [h for h in all_hashes if h.group_id is None]
        if new_hashes:
            # XXX: There is a race condition here wherein another process could
            # create a new group that is associated with one of the new hashes,
            # add some event(s) to it, and then subsequently have the hash
            # "stolen" by this process. This then "orphans" those events from
            # their "siblings" in the group we've created here. We don't have a
            # way to fix this, since we can't update the group on those hashes
            # without filtering on `group_id` (which we can't do due to query
            # planner weirdness.) For more context, see 84c6f75a and d0e22787,
            # as well as GH-5085.
            GroupHash.objects.filter(id__in=[h.id for h in new_hashes]).exclude(
                state=GroupHash.State.LOCKED_IN_MIGRATION
            ).update(group=group)

            if group_is_new and len(new_hashes) == len(all_hashes):
                is_new = True

        if not is_new:
            is_regression = self._process_existing_aggregate(
                group=group, event=event, data=kwargs, release=release
            )
        else:
            is_regression = False

        return group, is_new, is_regression

    def _handle_regression(self, group, event, release):
        if not group.is_resolved():
            return

        # we only mark it as a regression if the event's release is newer than
        # the release which we originally marked this as resolved
        elif GroupResolution.has_resolution(group, release):
            return

        elif has_pending_commit_resolution(group):
            return

        if not plugin_is_regression(group, event):
            return

        # we now think its a regression, rely on the database to validate that
        # no one beat us to this
        date = max(event.datetime, group.last_seen)
        is_regression = bool(
            Group.objects.filter(
                id=group.id,
                # ensure we cant update things if the status has been set to
                # ignored
                status__in=[GroupStatus.RESOLVED, GroupStatus.UNRESOLVED],
            )
            .exclude(
                # add to the regression window to account for races here
                active_at__gte=date
                - timedelta(seconds=5)
            )
            .update(
                active_at=date,
                # explicitly set last_seen here as ``is_resolved()`` looks
                # at the value
                last_seen=date,
                status=GroupStatus.UNRESOLVED,
            )
        )

        group.active_at = date
        group.status = GroupStatus.UNRESOLVED

        if is_regression and release:
            # resolutions are only valid if the state of the group is still
            # resolved -- if it were to change the resolution should get removed
            try:
                resolution = GroupResolution.objects.get(group=group)
            except GroupResolution.DoesNotExist:
                affected = False
            else:
                cursor = connection.cursor()
                # delete() API does not return affected rows
                cursor.execute("DELETE FROM sentry_groupresolution WHERE id = %s", [resolution.id])
                affected = cursor.rowcount > 0

            if affected:
                # if we had to remove the GroupResolution (i.e. we beat the
                # the queue to handling this) then we need to also record
                # the corresponding event
                try:
                    activity = Activity.objects.filter(
                        group=group, type=Activity.SET_RESOLVED_IN_RELEASE, ident=resolution.id
                    ).order_by("-datetime")[0]
                except IndexError:
                    # XXX: handle missing data, as its not overly important
                    pass
                else:
                    activity.update(data={"version": release.version})

        if is_regression:
            activity = Activity.objects.create(
                project_id=group.project_id,
                group=group,
                type=Activity.SET_REGRESSION,
                data={"version": release.version if release else ""},
            )
            activity.send_notification()

            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group.project_id, "group_id": group.id}
            )

        return is_regression

    def _process_existing_aggregate(self, group, event, data, release):
        date = max(event.datetime, group.last_seen)
        extra = {"last_seen": date, "score": ScoreClause(group), "data": data["data"]}
        if event.message and event.message != group.message:
            extra["message"] = event.message
        if group.level != data["level"]:
            extra["level"] = data["level"]
        if group.culprit != data["culprit"]:
            extra["culprit"] = data["culprit"]

        is_regression = self._handle_regression(group, event, release)

        group.last_seen = extra["last_seen"]

        update_kwargs = {"times_seen": 1}

        buffer.incr(Group, update_kwargs, {"id": group.id}, extra)

        return is_regression
