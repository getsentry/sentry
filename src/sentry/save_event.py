from __future__ import absolute_import, print_function

import ipaddress
import six

from datetime import timedelta
from django.core.cache import cache
from django.db import connection, IntegrityError, router, transaction
from django.db.models import Func
from django.utils.encoding import force_text

from sentry import buffer, eventstore, eventtypes, eventstream, features, tsdb
from sentry.attachments import attachment_cache
from sentry.constants import MAX_TAG_VALUE_LENGTH
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL, convert_crashreport_count
from sentry.models import (
    Activity,
    Environment,
    EventAttachment,
    EventDict,
    EventUser,
    File,
    Group,
    GroupHash,
    GroupLink,
    GroupResolution,
    GroupStatus,
    Release,
    ReleaseEnvironment,
    ReleaseProjectEnvironment,
    CRASH_REPORT_TYPES,
    get_crashreport_key,
)
from sentry.plugins.base import plugins
from sentry.signals import event_saved
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.utils import metrics
from sentry.utils.dates import to_timestamp
from sentry.utils.safe import safe_execute, trim, get_path, setdefault_path
from sentry.culprit import generate_culprit


# Timeout for cached group crash report counts
CRASH_REPORT_TIMEOUT = 24 * 3600  # one day


def pop_tag(data, key):
    data["tags"] = [kv for kv in data["tags"] if kv is None or kv[0] != key]


def set_tag(data, key, value):
    pop_tag(data, key)
    data["tags"].append((key, trim(value, MAX_TAG_VALUE_LENGTH)))


def get_tag(data, key):
    for k, v in get_path(data, "tags", filter=True):
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


def get_max_crashreports(model):
    value = model.get_option("sentry:store_crash_reports")
    return convert_crashreport_count(value)


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
    if cached_reports >= max_crashreports:
        return cached_reports

    # Fall-through if max_crashreports was bumped to get a more accurate number.
    return EventAttachment.objects.filter(
        group_id=event.group_id, file__type__in=CRASH_REPORT_TYPES
    ).count()


class HashDiscarded(Exception):
    pass


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

        job["logger_name"] = logger_name = data.get("logger")
        job["level"] = level = data.get("level")
        job["release"] = data.get("release")
        job["dist"] = data.get("dist")
        job["environment"] = environment = data.get("environment")
        job["recorded_timestamp"] = data.get("timestamp")
        job["event"] = event = _get_event_instance(job["data"], project_id=job["project_id"])
        job["data"] = data = event.data.data
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
            # dont allow a conflicting 'release' tag
            data = job["data"]
            pop_tag(data, "release")
            set_tag(data, "sentry:release", release.version)

            job["release"] = release


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


@metrics.wraps("save_event.send_event_saved_signal_many")
def _send_event_saved_signal_many(jobs, projects):
    for job in jobs:
        event_saved.send_robust(
            project=projects[job["project_id"]],
            event_size=job["event"].size,
            sender=_send_event_saved_signal_many,
        )


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
            primary_hash=job["data"]["hashes"][0],
            received_timestamp=job["received_timestamp"],
            # We are choosing to skip consuming the event back
            # in the eventstream if it's flagged as raw.
            # This means that we want to publish the event
            # through the event stream, but we don't care
            # about post processing and handling the commit.
            skip_consume=job.get("raw", False),
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


def get_attachments(cache_key, event):
    """
    Computes a list of attachments that should be stored.

    This method checks whether event attachments are available and sends them to
    the blob store. There is special handling for crash reports which may
    contain unstripped PII. If the project or organization is configured to
    limit the amount of crash reports per group, the number of stored crashes is
    limited.

    :param cache_key: The cache key at which the event payload is stored in the
                    cache. This is used to retrieve attachments.
    :param event:     The event model instance.
    """
    filtered = []

    if cache_key is None:
        return filtered

    project = event.project
    if not features.has("organizations:event-attachments", project.organization, actor=None):
        return filtered

    attachments = list(attachment_cache.get(cache_key))
    if not attachments:
        return filtered

    # The setting is both an organization and project setting. The project
    # setting strictly overrides the organization setting, unless set to the
    # default.
    max_crashreports = get_max_crashreports(project)
    if not max_crashreports:
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

    for attachment in attachments:
        # If the attachment is a crash report (e.g. minidump), we need to honor
        # the store_crash_reports setting. Otherwise, we assume that the client
        # has already verified PII and just store the attachment.
        if attachment.type in CRASH_REPORT_TYPES:
            if crashreports_exceeded(stored_reports, max_crashreports):
                continue
            stored_reports += 1

        filtered.append(attachment)

    # Check if we have exceeded the stored crash reports count. If so, we
    # persist the current maximum (not the actual number!) into the cache. Next
    # time when loading from the cache, we will validate that this number has
    # not changed, or otherwise re-fetch from the database.
    if crashreports_exceeded(stored_reports, max_crashreports) and stored_reports > cached_reports:
        cache.set(crashreports_key, max_crashreports, CRASH_REPORT_TIMEOUT)

    return filtered


def save_attachments(attachments, event):
    """
    Persists cached event attachments into the file store.

    :param attachments: A filtered list of attachments to save.
    :param event:       The event model instance.
    """
    for attachment in attachments:
        file = File.objects.create(
            name=attachment.name,
            type=attachment.type,
            headers={"Content-Type": attachment.content_type},
        )
        file.putfile(six.BytesIO(attachment.data))

        EventAttachment.objects.create(
            event_id=event.event_id,
            project_id=event.project_id,
            group_id=event.group_id,
            name=attachment.name,
            file=file,
        )


def _find_hashes(project, hash_list):
    return map(
        lambda hash: GroupHash.objects.get_or_create(project=project, hash=hash)[0], hash_list
    )
