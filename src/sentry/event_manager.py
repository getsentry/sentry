from __future__ import absolute_import, print_function

import logging


import ipaddress
import six

from datetime import datetime, timedelta
from django.conf import settings
from django.core.cache import cache
from django.db import connection, IntegrityError, router, transaction
from django.db.models import Func
from django.utils.encoding import force_text
from pytz import UTC

from sentry import buffer, eventstore, eventtypes, eventstream, features, tsdb
from sentry.attachments import MissingAttachmentChunks, attachment_cache
from sentry.constants import (
    DataCategory,
    DEFAULT_STORE_NORMALIZER_ARGS,
    LOG_LEVELS_MAP,
    MAX_TAG_VALUE_LENGTH,
)
from sentry.grouping.api import (
    get_grouping_config_dict_for_project,
    get_grouping_config_dict_for_event_data,
    load_grouping_config,
    apply_server_fingerprinting,
    get_fingerprinting_config_for_project,
    GroupingConfigNotFound,
)
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL, convert_crashreport_count
from sentry.models import (
    Activity,
    Environment,
    EventAttachment,
    EventDict,
    EventUser,
    File,
    Group,
    GroupEnvironment,
    GroupHash,
    GroupLink,
    GroupRelease,
    GroupResolution,
    GroupStatus,
    Project,
    ProjectKey,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    ReleaseProject,
    ReleaseProjectEnvironment,
    UserReport,
    Organization,
    CRASH_REPORT_TYPES,
    get_crashreport_key,
)
from sentry.plugins.base import plugins
from sentry import quotas
from sentry.signals import first_event_received
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.utils import json, metrics
from sentry.utils.canonical import CanonicalKeyDict
from sentry.ingest.inbound_filters import FilterStatKeys
from sentry.utils.dates import to_timestamp, to_datetime
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.safe import safe_execute, trim, get_path, setdefault_path
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.culprit import generate_culprit
from sentry.utils.compat import map
from sentry.reprocessing2 import save_unprocessed_event

logger = logging.getLogger("sentry.events")

SECURITY_REPORT_INTERFACES = ("csp", "hpkp", "expectct", "expectstaple")

# Timeout for cached group crash report counts
CRASH_REPORT_TIMEOUT = 24 * 3600  # one day


def pop_tag(data, key):
    if "tags" not in data:
        return

    data["tags"] = [kv for kv in data["tags"] if kv is None or kv[0] != key]


def set_tag(data, key, value):
    pop_tag(data, key)
    if value is not None:
        data.setdefault("tags", []).append((key, trim(value, MAX_TAG_VALUE_LENGTH)))


def get_tag(data, key):
    for k, v in get_path(data, "tags", filter=True) or ():
        if k == key:
            return v


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
    """
    Checks that the most recent commit that fixes a group has had a chance to release
    """
    recent_group_link = (
        GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )
        .order_by("-datetime")
        .first()
    )
    if recent_group_link is None:
        return False

    return not ReleaseCommit.objects.filter(commit__id=recent_group_link.linked_id).exists()


def get_max_crashreports(model, allow_none=False):
    value = model.get_option("sentry:store_crash_reports")
    return convert_crashreport_count(value, allow_none=allow_none)


def crashreports_exceeded(current_count, max_count):
    if max_count == STORE_CRASH_REPORTS_ALL:
        return False
    return current_count >= max_count


def get_stored_crashreports(cache_key, event, max_crashreports):
    # There are two common cases: Storing crash reports is disabled, or is
    # unbounded. In both cases, there is no need in caching values or querying
    # the database.
    if max_crashreports in (0, STORE_CRASH_REPORTS_ALL):
        return max_crashreports

    cached_reports = cache.get(cache_key, None)
    if cached_reports is not None and cached_reports >= max_crashreports:
        return cached_reports

    # Fall-through if max_crashreports was bumped to get a more accurate number.
    return EventAttachment.objects.filter(
        group_id=event.group_id, type__in=CRASH_REPORT_TYPES
    ).count()


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
        sent_at=None,
    ):
        self._data = CanonicalKeyDict(data)
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
        self.sent_at = sent_at

    def normalize(self, project_id=None):
        with metrics.timer("events.store.normalize.duration"):
            self._normalize_impl(project_id=project_id)

    def _normalize_impl(self, project_id=None):
        if self._project and project_id and project_id != self._project.id:
            raise RuntimeError(
                "Initialized EventManager with one project ID and called save() with another one"
            )

        if self._normalized:
            raise RuntimeError("Already normalized")

        self._normalized = True

        from sentry_relay.processing import StoreNormalizer

        rust_normalizer = StoreNormalizer(
            project_id=self._project.id if self._project else project_id,
            client_ip=self._client_ip,
            client=self._auth.client if self._auth else None,
            key_id=six.text_type(self._key.id) if self._key else None,
            grouping_config=self._grouping_config,
            protocol_version=six.text_type(self.version) if self.version is not None else None,
            is_renormalize=self._is_renormalize,
            remove_other=self._remove_other,
            normalize_user_agent=True,
            sent_at=self.sent_at.isoformat() if self.sent_at is not None else None,
            **DEFAULT_STORE_NORMALIZER_ARGS
        )

        self._data = CanonicalKeyDict(rust_normalizer.normalize_event(dict(self._data)))

    def get_data(self):
        return self._data

    @metrics.wraps("event_manager.save")
    def save(self, project_id, raw=False, assume_normalized=False, start_time=None, cache_key=None):
        """
        After normalizing and processing an event, save adjacent models such as
        releases and environments to postgres and write the event into
        eventstream. From there it will be picked up by Snuba and
        post-processing.

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
                self.normalize(project_id=project_id)
            self._normalized = True

        with metrics.timer("event_manager.save.project.get_from_cache"):
            project = Project.objects.get_from_cache(id=project_id)

        projects = {project.id: project}

        if self._data.get("type") == "transaction":
            self._data["project"] = int(project_id)
            job = {"data": self._data, "start_time": start_time}
            jobs = save_transaction_events([job], projects)
            return jobs[0]["event"]

        with metrics.timer("event_manager.save.organization.get_from_cache"):
            project._organization_cache = Organization.objects.get_from_cache(
                id=project.organization_id
            )

        job = {"data": self._data, "project_id": project_id, "raw": raw, "start_time": start_time}
        jobs = [job]

        _pull_out_data(jobs, projects)
        _get_or_create_release_many(jobs, projects)
        _get_event_user_many(jobs, projects)

        job["project_key"] = None
        if job["key_id"] is not None:
            with metrics.timer("event_manager.load_project_key"):
                try:
                    job["project_key"] = ProjectKey.objects.get_from_cache(id=job["key_id"])
                except ProjectKey.DoesNotExist:
                    pass

        with metrics.timer("event_manager.load_grouping_config"):
            # At this point we want to normalize the in_app values in case the
            # clients did not set this appropriately so far.
            grouping_config = load_grouping_config(
                get_grouping_config_dict_for_event_data(job["data"], project)
            )

        with metrics.timer("event_manager.normalize_stacktraces_for_grouping"):
            normalize_stacktraces_for_grouping(job["data"], grouping_config)

        _derive_plugin_tags_many(jobs, projects)
        _derive_interface_tags_many(jobs)

        with metrics.timer("event_manager.apply_server_fingerprinting"):
            # The active grouping config was put into the event in the
            # normalize step before.  We now also make sure that the
            # fingerprint was set to `'{{ default }}' just in case someone
            # removed it from the payload.  The call to get_hashes will then
            # look at `grouping_config` to pick the right parameters.
            job["data"]["fingerprint"] = job["data"].get("fingerprint") or ["{{ default }}"]
            apply_server_fingerprinting(job["data"], get_fingerprinting_config_for_project(project))

        with metrics.timer("event_manager.event.get_hashes"):
            # Here we try to use the grouping config that was requested in the
            # event.  If that config has since been deleted (because it was an
            # experimental grouping config) we fall back to the default.
            try:
                hashes = job["event"].get_hashes()
            except GroupingConfigNotFound:
                job["data"]["grouping_config"] = get_grouping_config_dict_for_project(project)
                hashes = job["event"].get_hashes()

        job["data"]["hashes"] = hashes

        _materialize_metadata_many(jobs)

        # The group gets the same metadata as the event when it's flushed but
        # additionally the `last_received` key is set.  This key is used by
        # _save_aggregate.
        group_metadata = dict(job["materialized_metadata"])
        group_metadata["last_received"] = job["received_timestamp"]
        kwargs = {
            "platform": job["platform"],
            "message": job["event"].search_message,
            "culprit": job["culprit"],
            "logger": job["logger_name"],
            "level": LOG_LEVELS_MAP.get(job["level"]),
            "last_seen": job["event"].datetime,
            "first_seen": job["event"].datetime,
            "active_at": job["event"].datetime,
            "data": group_metadata,
        }

        if job["release"]:
            kwargs["first_release"] = job["release"]

        # Load attachments first, but persist them at the very last after
        # posting to eventstream to make sure all counters and eventstream are
        # incremented for sure. Also wait for grouping to remove attachments
        # based on the group counter.
        with metrics.timer("event_manager.get_attachments"):
            attachments = get_attachments(cache_key, job)

        try:
            job["group"], job["is_new"], job["is_regression"] = _save_aggregate(
                event=job["event"], hashes=hashes, release=job["release"], **kwargs
            )
        except HashDiscarded:
            discard_event(job, attachments)
            raise

        job["event"].group = job["group"]

        # store a reference to the group id to guarantee validation of isolation
        # XXX(markus): No clue what this does
        job["event"].data.bind_ref(job["event"])

        _get_or_create_environment_many(jobs, projects)

        if job["group"]:
            group_environment, job["is_new_group_environment"] = GroupEnvironment.get_or_create(
                group_id=job["group"].id,
                environment_id=job["environment"].id,
                defaults={"first_release": job["release"] or None},
            )
        else:
            job["is_new_group_environment"] = False

        _get_or_create_release_associated_models(jobs, projects)

        if job["release"] and job["group"]:
            job["grouprelease"] = GroupRelease.get_or_create(
                group=job["group"],
                release=job["release"],
                environment=job["environment"],
                datetime=job["event"].datetime,
            )

        _tsdb_record_all_metrics(jobs)

        if job["group"]:
            UserReport.objects.filter(project=project, event_id=job["event"].event_id).update(
                group=job["group"], environment=job["environment"]
            )

        with metrics.timer("event_manager.filter_attachments_for_group"):
            attachments = filter_attachments_for_group(attachments, job)

        # XXX: DO NOT MUTATE THE EVENT PAYLOAD AFTER THIS POINT
        _materialize_event_metrics(jobs)

        for attachment in attachments:
            key = "bytes.stored.%s" % (attachment.type,)
            old_bytes = job["event_metrics"].get(key) or 0
            job["event_metrics"][key] = old_bytes + attachment.size

        _nodestore_save_many(jobs)
        save_unprocessed_event(project, event_id=job["event"].event_id)

        if job["release"]:
            if job["is_new"]:
                buffer.incr(
                    ReleaseProject,
                    {"new_groups": 1},
                    {"release_id": job["release"].id, "project_id": project.id},
                )
            if job["is_new_group_environment"]:
                buffer.incr(
                    ReleaseProjectEnvironment,
                    {"new_issues_count": 1},
                    {
                        "project_id": project.id,
                        "release_id": job["release"].id,
                        "environment_id": job["environment"].id,
                    },
                )

        if not raw:
            if not project.first_event:
                project.update(first_event=job["event"].datetime)
                first_event_received.send_robust(
                    project=project, event=job["event"], sender=Project
                )

        _eventstream_insert_many(jobs)

        # Do this last to ensure signals get emitted even if connection to the
        # file store breaks temporarily.
        with metrics.timer("event_manager.save_attachments"):
            save_attachments(cache_key, attachments, job)

        metric_tags = {"from_relay": "_relay_processed" in job["data"]}

        metrics.timing(
            "events.latency",
            job["received_timestamp"] - job["recorded_timestamp"],
            tags=metric_tags,
        )
        metrics.timing("events.size.data.post_save", job["event"].size, tags=metric_tags)
        metrics.incr(
            "events.post_save.normalize.errors",
            amount=len(job["data"].get("errors") or ()),
            tags=metric_tags,
        )

        _track_outcome_accepted_many(jobs)

        self._data = job["event"].data.data
        return job["event"]


@metrics.wraps("save_event.pull_out_data")
def _pull_out_data(jobs, projects):
    """
    A bunch of (probably) CPU bound stuff.
    """

    for job in jobs:
        job["project_id"] = int(job["project_id"])

        data = job["data"]

        # Pull the toplevel data we're interested in
        job["culprit"] = get_culprit(data)

        transaction_name = data.get("transaction")
        if transaction_name:
            transaction_name = force_text(transaction_name)
        job["transaction"] = transaction_name

        key_id = None if data is None else data.get("key_id")
        if key_id is not None:
            key_id = int(key_id)
        job["key_id"] = key_id

        job["logger_name"] = logger_name = data.get("logger")
        job["level"] = level = data.get("level")
        job["release"] = data.get("release")
        job["dist"] = data.get("dist")
        job["environment"] = environment = data.get("environment")
        job["recorded_timestamp"] = data.get("timestamp")
        job["event"] = event = _get_event_instance(job["data"], project_id=job["project_id"])
        job["data"] = data = event.data.data
        job["category"] = DataCategory.from_event_type(data.get("type"))
        job["platform"] = event.platform
        event._project_cache = projects[job["project_id"]]

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

        job["received_timestamp"] = job["event"].data.get("received") or float(
            job["event"].datetime.strftime("%s")
        )


@metrics.wraps("save_event.get_or_create_release_many")
def _get_or_create_release_many(jobs, projects):
    jobs_with_releases = {}
    release_date_added = {}

    for job in jobs:
        if not job["release"]:
            continue

        release_key = (job["project_id"], job["release"])
        jobs_with_releases.setdefault(release_key, []).append(job)
        new_datetime = job["event"].datetime
        old_datetime = release_date_added.get(release_key)
        if old_datetime is None or new_datetime > old_datetime:
            release_date_added[release_key] = new_datetime

    for (project_id, version), jobs_to_update in six.iteritems(jobs_with_releases):
        release = Release.get_or_create(
            project=projects[project_id],
            version=version,
            date_added=release_date_added[(project_id, version)],
        )

        for job in jobs_to_update:
            # Don't allow a conflicting 'release' tag
            data = job["data"]
            pop_tag(data, "release")
            set_tag(data, "sentry:release", release.version)

            job["release"] = release

            if job["dist"]:
                job["dist"] = job["release"].add_dist(job["dist"], job["event"].datetime)

                # dont allow a conflicting 'dist' tag
                pop_tag(job["data"], "dist")
                set_tag(job["data"], "sentry:dist", job["dist"].name)


@metrics.wraps("save_event.get_event_user_many")
def _get_event_user_many(jobs, projects):
    for job in jobs:
        data = job["data"]
        user = _get_event_user(projects[job["project_id"]], data)

        if user:
            pop_tag(data, "user")
            set_tag(data, "sentry:user", user.tag_value)

        job["user"] = user


@metrics.wraps("save_event.derive_plugin_tags_many")
def _derive_plugin_tags_many(jobs, projects):
    # XXX: We ought to inline or remove this one for sure
    plugins_for_projects = {
        p.id: plugins.for_project(p, version=None) for p in six.itervalues(projects)
    }

    for job in jobs:
        for plugin in plugins_for_projects[job["project_id"]]:
            added_tags = safe_execute(plugin.get_tags, job["event"], _with_transaction=False)
            if added_tags:
                data = job["data"]
                # plugins should not override user provided tags
                for key, value in added_tags:
                    if get_tag(data, key) is None:
                        set_tag(data, key, value)


@metrics.wraps("save_event.derive_interface_tags_many")
def _derive_interface_tags_many(jobs):
    # XXX: We ought to inline or remove this one for sure
    for job in jobs:
        data = job["data"]
        for path, iface in six.iteritems(job["event"].interfaces):
            for k, v in iface.iter_tags():
                set_tag(data, k, v)

            # Get rid of ephemeral interface data
            if iface.ephemeral:
                data.pop(iface.path, None)


@metrics.wraps("save_event.materialize_metadata_many")
def _materialize_metadata_many(jobs):
    for job in jobs:
        # we want to freeze not just the metadata and type in but also the
        # derived attributes.  The reason for this is that we push this
        # data into kafka for snuba processing and our postprocessing
        # picks up the data right from the snuba topic.  For most usage
        # however the data is dynamically overridden by Event.title and
        # Event.location (See Event.as_dict)
        data = job["data"]
        job["materialized_metadata"] = metadata = materialize_metadata(data)
        data.update(metadata)
        data["culprit"] = job["culprit"]


@metrics.wraps("save_event.get_or_create_environment_many")
def _get_or_create_environment_many(jobs, projects):
    for job in jobs:
        job["environment"] = Environment.get_or_create(
            project=projects[job["project_id"]], name=job["environment"]
        )


@metrics.wraps("save_event.get_or_create_release_associated_models")
def _get_or_create_release_associated_models(jobs, projects):
    # XXX: This is possibly unnecessarily detached from
    # _get_or_create_release_many, but we do not want to destroy order of
    # execution right now
    for job in jobs:
        release = job["release"]
        if not release:
            continue

        project = projects[job["project_id"]]
        environment = job["environment"]
        date = job["event"].datetime

        ReleaseEnvironment.get_or_create(
            project=project, release=release, environment=environment, datetime=date
        )

        ReleaseProjectEnvironment.get_or_create(
            project=project, release=release, environment=environment, datetime=date
        )


@metrics.wraps("save_event.tsdb_record_all_metrics")
def _tsdb_record_all_metrics(jobs):
    """
    Do all tsdb-related things for save_event in here s.t. we can potentially
    put everything in a single redis pipeline someday.
    """

    # XXX: validate whether anybody actually uses those metrics

    for job in jobs:
        incrs = []
        frequencies = []
        records = []

        incrs.append((tsdb.models.project, job["project_id"]))
        event = job["event"]
        group = job["group"]
        release = job["release"]
        environment = job["environment"]

        if group:
            incrs.append((tsdb.models.group, group.id))
            frequencies.append(
                (tsdb.models.frequent_environments_by_group, {group.id: {environment.id: 1}})
            )

            if release:
                frequencies.append(
                    (
                        tsdb.models.frequent_releases_by_group,
                        {group.id: {job["grouprelease"].id: 1}},
                    )
                )

        if release:
            incrs.append((tsdb.models.release, release.id))

        user = job["user"]

        if user:
            project_id = job["project_id"]
            records.append((tsdb.models.users_affected_by_project, project_id, (user.tag_value,)))

            if group:
                records.append((tsdb.models.users_affected_by_group, group.id, (user.tag_value,)))

        if incrs:
            tsdb.incr_multi(incrs, timestamp=event.datetime, environment_id=environment.id)

        if records:
            tsdb.record_multi(records, timestamp=event.datetime, environment_id=environment.id)

        if frequencies:
            tsdb.record_frequency_multi(frequencies, timestamp=event.datetime)


@metrics.wraps("save_event.nodestore_save_many")
def _nodestore_save_many(jobs):
    for job in jobs:
        # Write the event to Nodestore
        job["event"].data.save()


@metrics.wraps("save_event.eventstream_insert_many")
def _eventstream_insert_many(jobs):
    for job in jobs:
        eventstream.insert(
            group=job["group"],
            event=job["event"],
            is_new=job["is_new"],
            is_regression=job["is_regression"],
            is_new_group_environment=job["is_new_group_environment"],
            primary_hash=job["data"]["hashes"][0] if "hashes" in job["data"] else "",
            received_timestamp=job["received_timestamp"],
            # We are choosing to skip consuming the event back
            # in the eventstream if it's flagged as raw.
            # This means that we want to publish the event
            # through the event stream, but we don't care
            # about post processing and handling the commit.
            skip_consume=job.get("raw", False),
        )


@metrics.wraps("save_event.track_outcome_accepted_many")
def _track_outcome_accepted_many(jobs):
    for job in jobs:
        event = job["event"]

        track_outcome(
            org_id=event.project.organization_id,
            project_id=job["project_id"],
            key_id=job["key_id"],
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=to_datetime(job["start_time"]),
            event_id=event.event_id,
            category=job["category"],
        )


@metrics.wraps("event_manager.get_event_instance")
def _get_event_instance(data, project_id):
    event_id = data.get("event_id")

    return eventstore.create_event(
        project_id=project_id,
        event_id=event_id,
        group_id=None,
        data=EventDict(data, skip_renormalization=True),
    )


def _get_event_user(project, data):
    with metrics.timer("event_manager.get_event_user") as metrics_tags:
        return _get_event_user_impl(project, data, metrics_tags)


def _get_event_user_impl(project, data, metrics_tags):
    user_data = data.get("user")
    if not user_data:
        metrics_tags["event_has_user"] = "false"
        return

    metrics_tags["event_has_user"] = "true"

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
        metrics_tags["cache_hit"] = "false"
        try:
            with transaction.atomic(using=router.db_for_write(EventUser)):
                euser.save()
            metrics_tags["created"] = "true"
        except IntegrityError:
            metrics_tags["created"] = "false"
            try:
                euser = EventUser.objects.get(project_id=project.id, hash=euser.hash)
            except EventUser.DoesNotExist:
                metrics_tags["created"] = "lol"
                # why???
                e_userid = -1
            else:
                if euser.name != (user_data.get("name") or euser.name):
                    euser.update(name=user_data["name"])
                e_userid = euser.id
            cache.set(cache_key, e_userid, 3600)
    else:
        metrics_tags["cache_hit"] = "true"

    return euser


def get_event_type(data):
    return eventtypes.get(data.get("type", "default"))()


def materialize_metadata(data):
    """Returns the materialized metadata to be merged with group or
    event data.  This currently produces the keys `type`, `metadata`,
    `title` and `location`.  This should most likely also produce
    `culprit` here.
    """
    event_type = get_event_type(data)
    event_metadata = event_type.get_metadata(data)
    return {
        "type": event_type.key,
        "metadata": event_metadata,
        "title": event_type.get_title(event_metadata),
        "location": event_type.get_location(event_metadata),
    }


def get_culprit(data):
    """Helper to calculate the default culprit"""
    return force_text(
        data.get("culprit") or data.get("transaction") or generate_culprit(data) or ""
    )


def _save_aggregate(event, hashes, release, **kwargs):
    project = event.project

    # attempt to find a matching hash
    all_hashes = _find_hashes(project, hashes)

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

        short_id = project.next_short_id()

        with transaction.atomic():
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
        is_regression = _process_existing_aggregate(
            group=group, event=event, data=kwargs, release=release
        )
    else:
        is_regression = False

    return group, is_new, is_regression


def _handle_regression(group, event, release):
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


def _process_existing_aggregate(group, event, data, release):
    date = max(event.datetime, group.last_seen)
    extra = {"last_seen": date, "score": ScoreClause(group), "data": data["data"]}
    if event.search_message and event.search_message != group.message:
        extra["message"] = event.search_message
    if group.level != data["level"]:
        extra["level"] = data["level"]
    if group.culprit != data["culprit"]:
        extra["culprit"] = data["culprit"]
    if group.first_seen > event.datetime:
        extra["first_seen"] = event.datetime

    is_regression = _handle_regression(group, event, release)

    group.last_seen = extra["last_seen"]

    update_kwargs = {"times_seen": 1}

    buffer.incr(Group, update_kwargs, {"id": group.id}, extra)

    return is_regression


def discard_event(job, attachments):
    """
    Refunds consumed quotas for an event and its attachments.

    For the event and each dropped attachment, an outcome
    FILTERED(discarded-hash) is emitted.

    :param job:         The job context container.
    :param attachments: The full list of attachments to filter.
    """

    project = job["event"].project

    quotas.refund(
        project,
        key=job["project_key"],
        timestamp=job["start_time"],
        category=job["category"],
        quantity=1,
    )

    track_outcome(
        org_id=project.organization_id,
        project_id=job["project_id"],
        key_id=job["key_id"],
        outcome=Outcome.FILTERED,
        reason=FilterStatKeys.DISCARDED_HASH,
        timestamp=to_datetime(job["start_time"]),
        event_id=job["event"].event_id,
        category=job["category"],
    )

    attachment_quantity = 0
    for attachment in attachments:
        # Quotas are counted with at least ``1`` for attachments.
        attachment_quantity += attachment.size or 1

        track_outcome(
            org_id=project.organization_id,
            project_id=job["project_id"],
            key_id=job["key_id"],
            outcome=Outcome.FILTERED,
            reason=FilterStatKeys.DISCARDED_HASH,
            timestamp=to_datetime(job["start_time"]),
            event_id=job["event"].event_id,
            category=DataCategory.ATTACHMENT,
            quantity=attachment.size,
        )

    if attachment_quantity:
        quotas.refund(
            project,
            key=job["project_key"],
            timestamp=job["start_time"],
            category=DataCategory.ATTACHMENT,
            quantity=attachment_quantity,
        )

    metrics.incr(
        "events.discarded", skip_internal=True, tags={"platform": job["platform"]},
    )


def get_attachments(cache_key, job):
    """
    Retrieves the list of attachments for this event.

    This method skips attachments that have been marked for rate limiting by
    earlier ingestion pipeline.

    :param cache_key: The cache key at which the event payload is stored in the
                      cache. This is used to retrieve attachments.
    :param job:       The job context container.
    """
    if cache_key is None:
        return []

    project = job["event"].project
    if not features.has("organizations:event-attachments", project.organization, actor=None):
        return []

    attachments = list(attachment_cache.get(cache_key))
    if not attachments:
        return []

    return [attachment for attachment in attachments if not attachment.rate_limited]


def filter_attachments_for_group(attachments, job):
    """
    Removes crash reports exceeding the group-limit.

    If the project or organization is configured to limit the amount of crash
    reports per group, the number of stored crashes is limited. This requires
    `event.group` to be set.

    Emits one outcome per removed attachment.

    :param attachments: The full list of attachments to filter.
    :param job:         The job context container.
    """
    if not attachments:
        return attachments

    event = job["event"]
    project = event.project

    # The setting is both an organization and project setting. The project
    # setting strictly overrides the organization setting, unless set to the
    # default.
    max_crashreports = get_max_crashreports(project, allow_none=True)
    if max_crashreports is None:
        max_crashreports = get_max_crashreports(project.organization)

    # The number of crash reports is cached per group
    crashreports_key = get_crashreport_key(event.group_id)

    # Only fetch the number of stored crash reports if there is a crash report
    # in the list of attachments. Otherwise, we won't require this number.
    if any(attachment.type in CRASH_REPORT_TYPES for attachment in attachments):
        cached_reports = get_stored_crashreports(crashreports_key, event, max_crashreports)
    else:
        cached_reports = 0
    stored_reports = cached_reports

    filtered = []
    refund_quantity = 0
    for attachment in attachments:
        # If the attachment is a crash report (e.g. minidump), we need to honor
        # the store_crash_reports setting. Otherwise, we assume that the client
        # has already verified PII and just store the attachment.
        if attachment.type in CRASH_REPORT_TYPES:
            if crashreports_exceeded(stored_reports, max_crashreports):
                # Indicate that the crash report has been removed due to a limit
                # on the maximum number of crash reports. If this flag is True,
                # it indicates that there are *other* events in the same group
                # that store a crash report. This flag will therefore *not* be
                # set if storage of crash reports is completely disabled.
                if max_crashreports > 0:
                    job["data"]["metadata"]["stripped_crash"] = True

                track_outcome(
                    org_id=event.project.organization_id,
                    project_id=job["project_id"],
                    key_id=job["key_id"],
                    outcome=Outcome.FILTERED,
                    reason=FilterStatKeys.CRASH_REPORT_LIMIT,
                    timestamp=to_datetime(job["start_time"]),
                    event_id=event.event_id,
                    category=DataCategory.ATTACHMENT,
                    quantity=attachment.size,
                )

                # Quotas are counted with at least ``1`` for attachments.
                refund_quantity += attachment.size or 1
                continue
            stored_reports += 1

        filtered.append(attachment)

    # Check if we have exceeded the stored crash reports count. If so, we
    # persist the current maximum (not the actual number!) into the cache. Next
    # time when loading from the cache, we will validate that this number has
    # not changed, or otherwise re-fetch from the database.
    if crashreports_exceeded(stored_reports, max_crashreports) and stored_reports > cached_reports:
        cache.set(crashreports_key, max_crashreports, CRASH_REPORT_TIMEOUT)

    if refund_quantity:
        quotas.refund(
            project,
            key=job["project_key"],
            timestamp=job["start_time"],
            category=DataCategory.ATTACHMENT,
            quantity=refund_quantity,
        )

    return filtered


def save_attachment(
    cache_key, attachment, project, event_id, key_id=None, group_id=None, start_time=None
):
    """
    Persists a cached event attachments into the file store.

    Emits one outcome, either ACCEPTED on success or INVALID(missing_chunks) if
    retrieving the attachment data fails.

    :param cache_key:  The cache key at which the attachment is stored for
                       debugging purposes.
    :param attachment: The ``CachedAttachment`` instance to store.
    :param project:    The project model that this attachment belongs to.
    :param event_id:   Identifier of the event that this attachment belongs to.
                       The event does not have to be stored yet.
    :param key_id:     Optional identifier of the DSN that was used to ingest
                       the attachment.
    :param group_id:   Optional group identifier for the event. May be empty if
                       the event has not been stored yet, or if it is not
                       grouped.
    :param start_time: UNIX Timestamp (float) when the attachment was ingested.
                       If missing, the current time is used.
    """
    if start_time is not None:
        timestamp = to_datetime(start_time)
    else:
        timestamp = datetime.utcnow().replace(tzinfo=UTC)

    try:
        data = attachment.data
    except MissingAttachmentChunks:
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=key_id,
            outcome=Outcome.INVALID,
            reason="missing_chunks",
            timestamp=timestamp,
            event_id=event_id,
            category=DataCategory.ATTACHMENT,
        )

        logger.exception("Missing chunks for cache_key=%s", cache_key)
        return

    file = File.objects.create(
        name=attachment.name,
        type=attachment.type,
        headers={"Content-Type": attachment.content_type},
    )
    file.putfile(six.BytesIO(data), blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE)

    EventAttachment.objects.create(
        event_id=event_id,
        project_id=project.id,
        group_id=group_id,
        name=attachment.name,
        file=file,
        type=attachment.type,
    )

    track_outcome(
        org_id=project.organization_id,
        project_id=project.id,
        key_id=key_id,
        outcome=Outcome.ACCEPTED,
        reason=None,
        timestamp=timestamp,
        event_id=event_id,
        category=DataCategory.ATTACHMENT,
        quantity=attachment.size or 1,
    )


def save_attachments(cache_key, attachments, job):
    """
    Persists cached event attachments into the file store.

    Emits one outcome per attachment, either ACCEPTED on success or
    INVALID(missing_chunks) if retrieving the attachment fails.

    :param attachments: A filtered list of attachments to save.
    :param job:         The job context container.
    """
    event = job["event"]

    for attachment in attachments:
        save_attachment(
            cache_key,
            attachment,
            event.project,
            event.event_id,
            key_id=job["key_id"],
            group_id=event.group_id,
            start_time=job["start_time"],
        )


def _find_hashes(project, hash_list):
    return map(
        lambda hash: GroupHash.objects.get_or_create(project=project, hash=hash)[0], hash_list
    )


@metrics.wraps("event_manager.save_transactions.materialize_event_metrics")
def _materialize_event_metrics(jobs):
    for job in jobs:
        # Ensure the _metrics key exists. This is usually created during
        # and prefilled with ingestion sizes.
        event_metrics = job["event"].data.get("_metrics") or {}
        job["event"].data["_metrics"] = event_metrics

        # Capture the actual size that goes into node store.
        event_metrics["bytes.stored.event"] = len(json.dumps(dict(job["event"].data.items())))

        for metric_name in ("flag.processing.error", "flag.processing.fatal"):
            if event_metrics.get(metric_name):
                metrics.incr("event_manager.save.event_metrics.%s" % (metric_name,))

        job["event_metrics"] = event_metrics


@metrics.wraps("event_manager.save_transaction_events")
def save_transaction_events(jobs, projects):
    with metrics.timer("event_manager.save_transactions.collect_organization_ids"):
        organization_ids = set(project.organization_id for project in six.itervalues(projects))

    with metrics.timer("event_manager.save_transactions.fetch_organizations"):
        organizations = {
            o.id: o for o in Organization.objects.get_many_from_cache(organization_ids)
        }

    with metrics.timer("event_manager.save_transactions.set_organization_cache"):
        for project in six.itervalues(projects):
            try:
                project._organization_cache = organizations[project.organization_id]
            except KeyError:
                continue

    with metrics.timer("event_manager.save_transactions.prepare_jobs"):
        for job in jobs:
            job["project_id"] = job["data"]["project"]
            job["raw"] = False
            job["group"] = None
            job["is_new"] = False
            job["is_regression"] = False
            job["is_new_group_environment"] = False

    _pull_out_data(jobs, projects)
    _get_or_create_release_many(jobs, projects)
    _get_event_user_many(jobs, projects)
    _derive_plugin_tags_many(jobs, projects)
    _derive_interface_tags_many(jobs)
    _materialize_metadata_many(jobs)
    _get_or_create_environment_many(jobs, projects)
    _get_or_create_release_associated_models(jobs, projects)
    _tsdb_record_all_metrics(jobs)
    _materialize_event_metrics(jobs)
    _nodestore_save_many(jobs)
    _eventstream_insert_many(jobs)
    _track_outcome_accepted_many(jobs)
    return jobs
