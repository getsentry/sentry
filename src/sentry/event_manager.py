from __future__ import annotations

import copy
import ipaddress
import logging
import random
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from hashlib import md5
from io import BytesIO
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Tuple,
    Type,
    TypedDict,
    Union,
    cast,
)

import sentry_sdk
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import IntegrityError, OperationalError, connection, transaction
from django.db.models import Func
from django.utils.encoding import force_text
from pytz import UTC

from sentry import (
    eventstore,
    eventstream,
    eventtypes,
    features,
    options,
    quotas,
    reprocessing2,
    tsdb,
)
from sentry.attachments import CachedAttachment, MissingAttachmentChunks, attachment_cache
from sentry.constants import (
    DEFAULT_STORE_NORMALIZER_ARGS,
    LOG_LEVELS_MAP,
    MAX_TAG_VALUE_LENGTH,
    DataCategory,
)
from sentry.culprit import generate_culprit
from sentry.dynamic_sampling import LatestReleaseBias, LatestReleaseParams
from sentry.eventstore.processing import event_processing_store
from sentry.eventtypes import (
    CspEvent,
    DefaultEvent,
    ErrorEvent,
    ExpectCTEvent,
    ExpectStapleEvent,
    HpkpEvent,
    TransactionEvent,
)
from sentry.grouping.api import (
    BackgroundGroupingConfigLoader,
    GroupingConfig,
    GroupingConfigNotFound,
    SecondaryGroupingConfigLoader,
    apply_server_fingerprinting,
    detect_synthetic_exception,
    get_fingerprinting_config_for_project,
    get_grouping_config_dict_for_event_data,
    get_grouping_config_dict_for_project,
    load_grouping_config,
)
from sentry.grouping.result import CalculatedHashes
from sentry.ingest.inbound_filters import FilterStatKeys
from sentry.issues.grouptype import GroupCategory, reduce_noise
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka
from sentry.issues.utils import can_create_group, write_occurrence_to_platform
from sentry.killswitches import killswitch_matches_context
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL, convert_crashreport_count
from sentry.locks import locks
from sentry.models import (
    CRASH_REPORT_TYPES,
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
    Organization,
    Project,
    ProjectKey,
    PullRequest,
    Release,
    ReleaseCommit,
    ReleaseEnvironment,
    ReleaseProject,
    ReleaseProjectEnvironment,
    UserReport,
    get_crashreport_key,
)
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.plugins.base import plugins
from sentry.projectoptions.defaults import BETA_GROUPING_CONFIG, DEFAULT_GROUPING_CONFIG
from sentry.quotas.base import index_data_category
from sentry.ratelimits.sliding_windows import Quota, RedisSlidingWindowRateLimiter, RequestedQuota
from sentry.reprocessing2 import is_reprocessed_event, save_unprocessed_event
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.signals import (
    first_event_received,
    first_event_with_minified_stack_trace_received,
    first_transaction_received,
    issue_unresolved,
)
from sentry.tasks.commits import fetch_commits
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.tasks.process_buffer import buffer_incr
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils import json, metrics
from sentry.utils.cache import cache_key_for_event
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.event import has_event_minified_stack_trace
from sentry.utils.metrics import MutableTags
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.performance_issues.performance_detection import (
    EventPerformanceProblem,
    PerformanceProblem,
    detect_performance_problems,
)
from sentry.utils.safe import get_path, safe_execute, setdefault_path, trim

if TYPE_CHECKING:
    from sentry.eventstore.models import BaseEvent, Event

logger = logging.getLogger("sentry.events")

SECURITY_REPORT_INTERFACES = ("csp", "hpkp", "expectct", "expectstaple")

# Timeout for cached group crash report counts
CRASH_REPORT_TIMEOUT = 24 * 3600  # one day

issue_rate_limiter = RedisSlidingWindowRateLimiter(
    **settings.SENTRY_PERFORMANCE_ISSUES_RATE_LIMITER_OPTIONS
)
PERFORMANCE_ISSUE_QUOTA = Quota(3600, 60, 5)


@dataclass
class GroupInfo:
    group: Group
    is_new: bool
    is_regression: bool
    group_release: Optional[GroupRelease] = None
    is_new_group_environment: bool = False


def pop_tag(data: dict[str, Any], key: str) -> None:
    if "tags" not in data:
        return

    data["tags"] = [kv for kv in data["tags"] if kv is None or kv[0] != key]


def set_tag(data: dict[str, Any], key: str, value: Any) -> None:
    pop_tag(data, key)
    if value is not None:
        data.setdefault("tags", []).append((key, trim(value, MAX_TAG_VALUE_LENGTH)))


def get_tag(data: dict[str, Any], key: str) -> Optional[Any]:
    for k, v in get_path(data, "tags", filter=True) or ():
        if k == key:
            return v
    return None


def plugin_is_regression(group: Group, event: Event) -> bool:
    project = event.project
    for plugin in plugins.for_project(project):
        result = safe_execute(
            plugin.is_regression, group, event, version=1, _with_transaction=False
        )
        if result is not None:
            return bool(result)
    return True


def has_pending_commit_resolution(group: Group) -> bool:
    """
    Checks that the most recent commit that fixes a group has had a chance to release
    """
    latest_issue_commit_resolution = (
        GroupLink.objects.filter(
            group_id=group.id,
            linked_type=GroupLink.LinkedType.commit,
            relationship=GroupLink.Relationship.resolves,
        )
        .order_by("-datetime")
        .first()
    )
    if latest_issue_commit_resolution is None:
        return False

    # commit has been released and is not in pending commit state
    if ReleaseCommit.objects.filter(commit__id=latest_issue_commit_resolution.linked_id).exists():
        return False
    else:
        # check if this commit is a part of a PR
        pr_ids = PullRequest.objects.filter(
            pullrequestcommit__commit=latest_issue_commit_resolution.linked_id
        ).values_list("id", flat=True)
        # assume that this commit has been released if any commits in this PR have been released
        if ReleaseCommit.objects.filter(
            commit__pullrequestcommit__pull_request__in=pr_ids
        ).exists():
            return False
        return True


def get_max_crashreports(
    model: Union[Project, Organization], allow_none: bool = False
) -> Optional[int]:
    value = model.get_option("sentry:store_crash_reports")
    return convert_crashreport_count(value, allow_none=allow_none)  # type: ignore


def crashreports_exceeded(current_count: int, max_count: int) -> bool:
    if max_count == STORE_CRASH_REPORTS_ALL:
        return False
    return current_count >= max_count


def get_stored_crashreports(cache_key: Optional[str], event: Event, max_crashreports: int) -> int:
    # There are two common cases: Storing crash reports is disabled, or is
    # unbounded. In both cases, there is no need in caching values or querying
    # the database.
    if max_crashreports in (0, STORE_CRASH_REPORTS_ALL):
        return max_crashreports

    cached_reports = cache.get(cache_key, None)
    if cached_reports is not None and cached_reports >= max_crashreports:
        return cached_reports  # type: ignore

    # Fall-through if max_crashreports was bumped to get a more accurate number.
    # We don't need the actual number, but just whether it's more or equal to
    # the currently allowed maximum.
    query = EventAttachment.objects.filter(group_id=event.group_id, type__in=CRASH_REPORT_TYPES)
    return query[:max_crashreports].count()  # type: ignore


class HashDiscarded(Exception):
    def __init__(
        self, message: str = "", reason: Optional[str] = None, tombstone_id: Optional[int] = None
    ):
        super().__init__(message)
        self.reason = reason
        self.tombstone_id = tombstone_id


class ScoreClause(Func):  # type: ignore
    def __init__(self, group=None, last_seen=None, times_seen=None, *args, **kwargs):  # type: ignore
        self.group = group
        self.last_seen = last_seen
        self.times_seen = times_seen
        # times_seen is likely an F-object that needs the value extracted
        if hasattr(self.times_seen, "rhs"):
            self.times_seen = self.times_seen.rhs.value
        super().__init__(*args, **kwargs)

    def __int__(self):  # type: ignore
        # Calculate the score manually when coercing to an int.
        # This is used within create_or_update and friends
        return self.group.get_score() if self.group else 0

    def as_sql(self, compiler, connection, function=None, template=None):  # type: ignore
        has_values = self.last_seen is not None and self.times_seen is not None
        if has_values:
            sql = "log(times_seen + %d) * 600 + %d" % (
                self.times_seen,
                to_timestamp(self.last_seen),
            )
        else:
            sql = "log(times_seen) * 600 + last_seen::abstime::int"

        return (sql, [])


ProjectsMapping = Mapping[int, Project]

Job = MutableMapping[str, Any]


class EventManager:
    """
    Handles normalization in both the store endpoint and the save task. The
    intention is to swap this class out with a reimplementation in Rust.
    """

    def __init__(
        self,
        data: dict[str, Any],
        version: str = "5",
        project: Optional[Project] = None,
        grouping_config: Optional[GroupingConfig] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        auth: Optional[Any] = None,
        key: Optional[Any] = None,
        content_encoding: Optional[str] = None,
        is_renormalize: bool = False,
        remove_other: Optional[bool] = None,
        project_config: Optional[Any] = None,
        sent_at: Optional[datetime] = None,
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

    def normalize(self, project_id: Optional[int] = None) -> None:
        with metrics.timer("events.store.normalize.duration"):
            self._normalize_impl(project_id=project_id)

    def _normalize_impl(self, project_id: Optional[int] = None) -> None:
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
            key_id=str(self._key.id) if self._key else None,
            grouping_config=self._grouping_config,
            protocol_version=str(self.version) if self.version is not None else None,
            is_renormalize=self._is_renormalize,
            remove_other=self._remove_other,
            normalize_user_agent=True,
            sent_at=self.sent_at.isoformat() if self.sent_at is not None else None,
            **DEFAULT_STORE_NORMALIZER_ARGS,
        )

        pre_normalize_type = self._data.get("type")
        self._data = CanonicalKeyDict(rust_normalizer.normalize_event(dict(self._data)))
        # XXX: This is a hack to make generic events work (for now?). I'm not sure whether we should
        # include this in the rust normalizer, since we don't want people sending us these via the
        # sdk.
        if pre_normalize_type == "generic":
            self._data["type"] = pre_normalize_type

    def get_data(self) -> CanonicalKeyDict:
        return self._data

    @metrics.wraps("event_manager.save")
    def save(
        self,
        project_id: Optional[int],
        raw: bool = False,
        assume_normalized: bool = False,
        start_time: Optional[int] = None,
        cache_key: Optional[str] = None,
        skip_send_first_transaction: bool = False,
        auto_upgrade_grouping: bool = False,
    ) -> Event:
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

        job = {"data": self._data, "project_id": project.id, "raw": raw, "start_time": start_time}

        event_type = self._data.get("type")
        if event_type == "transaction":
            job["data"]["project"] = project.id
            jobs = save_transaction_events([job], projects)

            if not project.flags.has_transactions and not skip_send_first_transaction:
                first_transaction_received.send_robust(
                    project=project, event=jobs[0]["event"], sender=Project
                )

            return jobs[0]["event"]
        elif event_type == "generic":
            job["data"]["project"] = project.id
            jobs = save_generic_events([job], projects)

            return jobs[0]["event"]

        with metrics.timer("event_manager.save.organization.get_from_cache"):
            project.set_cached_field_value(
                "organization", Organization.objects.get_from_cache(id=project.organization_id)
            )

        jobs = [job]

        is_reprocessed = is_reprocessed_event(job["data"])

        with sentry_sdk.start_span(op="event_manager.save.pull_out_data"):
            _pull_out_data(jobs, projects)

        with sentry_sdk.start_span(op="event_manager.save.get_or_create_release_many"):
            _get_or_create_release_many(jobs, projects)

        with sentry_sdk.start_span(op="event_manager.save.get_event_user_many"):
            _get_event_user_many(jobs, projects)

        job["project_key"] = None
        if job["key_id"] is not None:
            with metrics.timer("event_manager.load_project_key"):
                try:
                    job["project_key"] = ProjectKey.objects.get_from_cache(id=job["key_id"])
                except ProjectKey.DoesNotExist:
                    pass

        _derive_plugin_tags_many(jobs, projects)
        _derive_interface_tags_many(jobs)

        do_background_grouping_before = options.get("store.background-grouping-before")
        if do_background_grouping_before:
            _run_background_grouping(project, job)

        secondary_hashes = None
        migrate_off_hierarchical = False

        try:
            secondary_grouping_config = project.get_option("sentry:secondary_grouping_config")
            secondary_grouping_expiry = project.get_option("sentry:secondary_grouping_expiry")
            if secondary_grouping_config and (secondary_grouping_expiry or 0) >= time.time():
                with metrics.timer("event_manager.secondary_grouping"):
                    secondary_event = copy.deepcopy(job["event"])
                    loader = SecondaryGroupingConfigLoader()
                    secondary_grouping_config = loader.get_config_dict(project)
                    secondary_hashes = _calculate_event_grouping(
                        project, secondary_event, secondary_grouping_config
                    )
        except Exception:
            sentry_sdk.capture_exception()

        with metrics.timer("event_manager.load_grouping_config"):
            # At this point we want to normalize the in_app values in case the
            # clients did not set this appropriately so far.
            if is_reprocessed:
                # The customer might have changed grouping enhancements since
                # the event was ingested -> make sure we get the fresh one for reprocessing.
                grouping_config = get_grouping_config_dict_for_project(project)
                # Write back grouping config because it might have changed since the
                # event was ingested.
                # NOTE: We could do this unconditionally (regardless of `is_processed`).
                job["data"]["grouping_config"] = grouping_config
            else:
                grouping_config = get_grouping_config_dict_for_event_data(
                    job["event"].data.data, project
                )

        with sentry_sdk.start_span(op="event_manager.save.calculate_event_grouping"), metrics.timer(
            "event_manager.calculate_event_grouping"
        ):
            hashes = _calculate_event_grouping(project, job["event"], grouping_config)

        # Because this logic is not complex enough we want to special case the situation where we
        # migrate from a hierarchical hash to a non hierarchical hash.  The reason being that
        # `_save_aggregate` needs special logic to not create orphaned hashes in migration cases
        # but it wants a different logic to implement splitting of hierarchical hashes.
        migrate_off_hierarchical = bool(
            secondary_hashes
            and secondary_hashes.hierarchical_hashes
            and not hashes.hierarchical_hashes
        )

        hashes = CalculatedHashes(
            hashes=list(hashes.hashes) + list(secondary_hashes and secondary_hashes.hashes or []),
            hierarchical_hashes=(
                list(hashes.hierarchical_hashes)
                + list(secondary_hashes and secondary_hashes.hierarchical_hashes or [])
            ),
            tree_labels=(
                hashes.tree_labels or (secondary_hashes and secondary_hashes.tree_labels) or []
            ),
        )

        if not do_background_grouping_before:
            _run_background_grouping(project, job)

        if hashes.tree_labels:
            job["finest_tree_label"] = hashes.finest_tree_label

        _materialize_metadata_many(jobs)

        kwargs = _create_kwargs(job)

        kwargs["culprit"] = job["culprit"]

        # Load attachments first, but persist them at the very last after
        # posting to eventstream to make sure all counters and eventstream are
        # incremented for sure. Also wait for grouping to remove attachments
        # based on the group counter.
        with metrics.timer("event_manager.get_attachments"):
            with sentry_sdk.start_span(op="event_manager.save.get_attachments"):
                attachments = get_attachments(cache_key, job)

        try:
            with sentry_sdk.start_span(op="event_manager.save.save_aggregate_fn"):
                group_info = _save_aggregate(
                    event=job["event"],
                    hashes=hashes,
                    release=job["release"],
                    metadata=dict(job["event_metadata"]),
                    received_timestamp=job["received_timestamp"],
                    migrate_off_hierarchical=migrate_off_hierarchical,
                    **kwargs,
                )
                job["groups"] = [group_info]
        except HashDiscarded as err:
            logger.info(
                "event_manager.save.discard",
                extra={
                    "reason": err.reason,
                    "tombstone_id": err.tombstone_id,
                },
            )
            discard_event(job, attachments)
            raise

        if not group_info:
            return job["event"]

        job["event"].group = group_info.group

        # store a reference to the group id to guarantee validation of isolation
        # XXX(markus): No clue what this does
        job["event"].data.bind_ref(job["event"])

        _get_or_create_environment_many(jobs, projects)
        _get_or_create_group_environment_many(jobs, projects)
        _get_or_create_release_associated_models(jobs, projects)
        _increment_release_associated_counts_many(jobs, projects)
        _get_or_create_group_release_many(jobs, projects)
        _tsdb_record_all_metrics(jobs)

        UserReport.objects.filter(project_id=project.id, event_id=job["event"].event_id).update(
            group_id=group_info.group.id, environment_id=job["environment"].id
        )

        with metrics.timer("event_manager.filter_attachments_for_group"):
            attachments = filter_attachments_for_group(attachments, job)

        # XXX: DO NOT MUTATE THE EVENT PAYLOAD AFTER THIS POINT
        _materialize_event_metrics(jobs)

        for attachment in attachments:
            key = f"bytes.stored.{attachment.type}"
            old_bytes = job["event_metrics"].get(key) or 0
            job["event_metrics"][key] = old_bytes + attachment.size

        _nodestore_save_many(jobs)
        save_unprocessed_event(project, job["event"].event_id)

        if not raw:
            if not project.first_event:
                project.update(first_event=job["event"].datetime)
                first_event_received.send_robust(
                    project=project, event=job["event"], sender=Project
                )

            if (
                has_event_minified_stack_trace(job["event"])
                and not project.flags.has_minified_stack_trace
            ):
                first_event_with_minified_stack_trace_received.send_robust(
                    project=project, event=job["event"], sender=Project
                )

        if is_reprocessed:
            safe_execute(
                reprocessing2.buffered_delete_old_primary_hash,
                project_id=job["event"].project_id,
                group_id=reprocessing2.get_original_group_id(job["event"]),
                event_id=job["event"].event_id,
                datetime=job["event"].datetime,
                old_primary_hash=reprocessing2.get_original_primary_hash(job["event"]),
                current_primary_hash=job["event"].get_primary_hash(),
                _with_transaction=False,
            )

        _eventstream_insert_many(jobs)

        # Do this last to ensure signals get emitted even if connection to the
        # file store breaks temporarily.
        #
        # We do not need this for reprocessed events as for those we update the
        # group_id on existing models in post_process_group, which already does
        # this because of indiv. attachments.
        if not is_reprocessed:
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

        # Check if the project is configured for auto upgrading and we need to upgrade
        # to the latest grouping config.
        if auto_upgrade_grouping and _project_should_update_grouping(project):
            _auto_update_grouping(project)

        return job["event"]


def _project_should_update_grouping(project: Project) -> bool:
    should_update_org = (
        project.organization_id % 1000 < float(settings.SENTRY_GROUPING_AUTO_UPDATE_ENABLED) * 1000
    )
    return bool(project.get_option("sentry:grouping_auto_update")) and should_update_org


def _auto_update_grouping(project: Project) -> None:
    old_grouping = project.get_option("sentry:grouping_config")
    new_grouping = DEFAULT_GROUPING_CONFIG

    # update to latest grouping config but not if a user is already on
    # beta.
    if old_grouping == new_grouping or old_grouping == BETA_GROUPING_CONFIG:
        return

    # Because the way the auto grouping upgrading happening is racy, we want to
    # try to write the audit log entry only and project option change just once.
    # For this a cache key is used.  That's not perfect, but should reduce the
    # risk significantly.
    cache_key = f"grouping-config-update:{project.id}:{old_grouping}"
    lock = f"grouping-update-lock:{project.id}"
    if cache.get(cache_key) is not None:
        return

    with locks.get(lock, duration=60, name="grouping-update-lock").acquire():
        if cache.get(cache_key) is None:
            cache.set(cache_key, "1", 60 * 5)
        else:
            return

        from sentry import audit_log
        from sentry.utils.audit import create_system_audit_entry

        expiry = int(time.time()) + settings.SENTRY_GROUPING_UPDATE_MIGRATION_PHASE
        changes = {
            "sentry:secondary_grouping_config": old_grouping,
            "sentry:secondary_grouping_expiry": expiry,
            "sentry:grouping_config": new_grouping,
        }
        for (key, value) in changes.items():
            project.update_option(key, value)
        create_system_audit_entry(
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id("PROJECT_EDIT"),
            data={**changes, **project.get_audit_log_data()},
        )


@metrics.wraps("event_manager.background_grouping")
def _calculate_background_grouping(
    project: Project, event: Event, config: GroupingConfig
) -> CalculatedHashes:
    return _calculate_event_grouping(project, event, config)


def _run_background_grouping(project: Project, job: Job) -> None:
    """Optionally run a fraction of events with a third grouping config
    This can be helpful to measure its performance impact.
    This does not affect actual grouping.
    """
    try:
        sample_rate = options.get("store.background-grouping-sample-rate")
        if sample_rate and random.random() <= sample_rate:
            config = BackgroundGroupingConfigLoader().get_config_dict(project)
            if config["id"]:
                copied_event = copy.deepcopy(job["event"])
                _calculate_background_grouping(project, copied_event, config)
    except Exception:
        sentry_sdk.capture_exception()


@metrics.wraps("save_event.pull_out_data")
def _pull_out_data(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    """
    A bunch of (probably) CPU bound stuff.
    """

    for job in jobs:
        job["project_id"] = int(job["project_id"])

        data = job["data"]

        # Pull the toplevel data we're interested in

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

        event._project_cache = project = projects[job["project_id"]]
        job["category"] = index_data_category(data.get("type"), project.organization)
        job["platform"] = event.platform

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


def _is_commit_sha(version: str) -> bool:
    return re.match(r"[0-9a-f]{40}", version) is not None


def _associate_commits_with_release(release: Release, project: Project) -> None:
    previous_release = release.get_previous_release(project)
    possible_repos = (
        RepositoryProjectPathConfig.objects.select_related("repository")
        .filter(project=project, repository__provider="integrations:github")
        .all()
    )
    if possible_repos:
        # If it does exist, kick off a task to look if the commit exists in the repository
        target_repo = None
        for repo_proj_path_model in possible_repos:
            ois = integration_service.get_organization_integrations(
                org_integration_ids=[repo_proj_path_model.organization_integration_id]
            )
            oi = ois[0]
            if not oi:
                continue
            integration = integration_service.get_integration(integration_id=oi.integration_id)
            if not integration:
                continue
            integration_installation = integration_service.get_installation(
                integration=integration, organization_id=oi.organization_id
            )
            if not integration_installation:
                continue
            repo_client = integration_installation.get_client()
            try:
                repo_client.get_commit(
                    repo=repo_proj_path_model.repository.name, sha=release.version
                )
                target_repo = repo_proj_path_model.repository
                break
            except ApiError as exc:
                if exc.code != 404:
                    raise

        if target_repo is not None:
            # If it does exist, fetch the commits for that repo
            fetch_commits.apply_async(
                kwargs={
                    "release_id": release.id,
                    "user_id": None,
                    "refs": [{"repository": target_repo.name, "commit": release.version}],
                    "prev_release_id": previous_release.id
                    if previous_release is not None
                    else None,
                }
            )


@metrics.wraps("save_event.get_or_create_release_many")
def _get_or_create_release_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    jobs_with_releases: dict[tuple[int, Release], list[Job]] = {}
    release_date_added: dict[tuple[int, Release], datetime] = {}

    for job in jobs:
        if not job["release"]:
            continue

        release_key = (job["project_id"], job["release"])
        jobs_with_releases.setdefault(release_key, []).append(job)
        new_datetime = job["event"].datetime
        old_datetime = release_date_added.get(release_key)
        if old_datetime is None or new_datetime > old_datetime:
            release_date_added[release_key] = new_datetime

    for (project_id, version), jobs_to_update in jobs_with_releases.items():
        try:
            release = Release.get_or_create(
                project=projects[project_id],
                version=version,
                date_added=release_date_added[(project_id, version)],
            )
        except ValidationError:
            release = None
            logger.exception(
                "Failed creating Release due to ValidationError",
                extra={
                    "project": projects[project_id],
                    "version": version,
                },
            )

        if release:
            if features.has(
                "projects:auto-associate-commits-to-release", projects[project_id]
            ) and _is_commit_sha(release.version):
                safe_execute(_associate_commits_with_release, release, projects[project_id])

            for job in jobs_to_update:
                # Don't allow a conflicting 'release' tag
                data = job["data"]
                pop_tag(data, "release")
                set_tag(data, "sentry:release", release.version)

                job["release"] = release

                if job["dist"]:
                    job["dist"] = job["release"].add_dist(job["dist"], job["event"].datetime)

                    # don't allow a conflicting 'dist' tag
                    pop_tag(job["data"], "dist")
                    set_tag(job["data"], "sentry:dist", job["dist"].name)

                # Dynamic Sampling - Boosting latest release functionality
                if (
                    options.get("dynamic-sampling:boost-latest-release")
                    and features.has(
                        "organizations:dynamic-sampling", projects[project_id].organization
                    )
                    and options.get("dynamic-sampling:enabled-biases")
                    and data.get("type") == "transaction"
                ):
                    with sentry_sdk.start_span(
                        op="event_manager.dynamic_sampling_observe_latest_release"
                    ) as span:
                        try:
                            latest_release_params = LatestReleaseParams(
                                release=release,
                                project=projects[project_id],
                                environment=_get_environment_from_transaction(data),
                            )

                            def on_release_boosted() -> None:
                                span.set_tag(
                                    "dynamic_sampling.observe_release_status",
                                    "(release, environment) pair observed and boosted",
                                )
                                span.set_data("release", latest_release_params.release.id)
                                span.set_data("environment", latest_release_params.environment)

                                schedule_invalidate_project_config(
                                    project_id=project_id,
                                    trigger="dynamic_sampling:boost_release",
                                )

                            LatestReleaseBias(
                                latest_release_params=latest_release_params
                            ).observe_release(on_boosted_release_added=on_release_boosted)
                        except Exception:
                            sentry_sdk.capture_exception()


def _get_environment_from_transaction(data: EventDict) -> Optional[str]:
    environment = data.get("environment", None)
    # We handle the case in which the users sets the empty string as environment, for us that
    # is equal to having no environment at all.
    if environment == "":
        environment = None

    return environment  # type:ignore


@metrics.wraps("save_event.get_event_user_many")
def _get_event_user_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        data = job["data"]
        user = _get_event_user(projects[job["project_id"]], data)

        if user:
            pop_tag(data, "user")
            set_tag(data, "sentry:user", user.tag_value)

        job["user"] = user


@metrics.wraps("save_event.derive_plugin_tags_many")
def _derive_plugin_tags_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    # XXX: We ought to inline or remove this one for sure
    plugins_for_projects = {p.id: plugins.for_project(p, version=None) for p in projects.values()}

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
def _derive_interface_tags_many(jobs: Sequence[Job]) -> None:
    # XXX: We ought to inline or remove this one for sure
    for job in jobs:
        data = job["data"]
        for path, iface in job["event"].interfaces.items():
            for k, v in iface.iter_tags():
                set_tag(data, k, v)

            # Get rid of ephemeral interface data
            if iface.ephemeral:
                data.pop(iface.path, None)


@metrics.wraps("save_event.materialize_metadata_many")
def _materialize_metadata_many(jobs: Sequence[Job]) -> None:
    for job in jobs:
        # we want to freeze not just the metadata and type in but also the
        # derived attributes.  The reason for this is that we push this
        # data into kafka for snuba processing and our postprocessing
        # picks up the data right from the snuba topic.  For most usage
        # however the data is dynamically overridden by Event.title and
        # Event.location (See Event.as_dict)
        #
        # We also need to ensure the culprit is accurately reflected at
        # the point of metadata materialization as we need to ensure that
        # processing happens before.
        data = job["data"]
        event_type = get_event_type(data)
        event_metadata = event_type.get_metadata(data)
        job["event_metadata"] = dict(event_metadata)

        # In save_aggregate we store current_tree_label for the group metadata,
        # and finest_tree_label for the event's own title.

        if "finest_tree_label" in job:
            event_metadata["finest_tree_label"] = job["finest_tree_label"]

        data.update(materialize_metadata(data, event_type, event_metadata))
        job["culprit"] = data["culprit"]


def _create_kwargs(job: Union[Job, PerformanceJob]) -> dict[str, Any]:
    kwargs = {
        "platform": job["platform"],
        "message": job["event"].search_message,
        "logger": job["logger_name"],
        "level": LOG_LEVELS_MAP.get(job["level"]),
        "last_seen": job["event"].datetime,
        "first_seen": job["event"].datetime,
        "active_at": job["event"].datetime,
    }

    if job["release"]:
        kwargs["first_release"] = job["release"]

    return kwargs


@metrics.wraps("save_event.get_or_create_environment_many")
def _get_or_create_environment_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        job["environment"] = Environment.get_or_create(
            project=projects[job["project_id"]], name=job["environment"]
        )


@metrics.wraps("save_event.get_or_create_group_environment_many")
def _get_or_create_group_environment_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        _get_or_create_group_environment(job["environment"], job["release"], job["groups"])


def _get_or_create_group_environment(
    environment: Environment, release: Optional[Release], groups: Sequence[GroupInfo]
) -> None:
    for group_info in groups:
        group_info.is_new_group_environment = GroupEnvironment.get_or_create(
            group_id=group_info.group.id,
            environment_id=environment.id,
            defaults={"first_release": release or None},
        )[1]


@metrics.wraps("save_event.get_or_create_release_associated_models")
def _get_or_create_release_associated_models(
    jobs: Sequence[Job], projects: ProjectsMapping
) -> None:
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


def _increment_release_associated_counts_many(
    jobs: Sequence[Job], projects: ProjectsMapping
) -> None:
    for job in jobs:
        _increment_release_associated_counts(
            projects[job["project_id"]], job["environment"], job["release"], job["groups"]
        )


def _increment_release_associated_counts(
    project: Project,
    environment: Environment,
    release: Optional[Release],
    groups: Sequence[GroupInfo],
) -> None:
    if not release:
        return

    rp_new_groups = 0
    rpe_new_groups = 0
    for group_info in groups:
        if group_info.is_new:
            rp_new_groups += 1
        if group_info.is_new_group_environment:
            rpe_new_groups += 1
    if rp_new_groups:
        buffer_incr(
            ReleaseProject,
            {"new_groups": rp_new_groups},
            {"release_id": release.id, "project_id": project.id},
        )
    if rpe_new_groups:
        buffer_incr(
            ReleaseProjectEnvironment,
            {"new_issues_count": rpe_new_groups},
            {
                "project_id": project.id,
                "release_id": release.id,
                "environment_id": environment.id,
            },
        )


@metrics.wraps("save_event.get_or_create_group_release_many")
def _get_or_create_group_release_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        _get_or_create_group_release(
            job["environment"], job["release"], job["event"], job["groups"]
        )


def _get_or_create_group_release(
    environment: Environment,
    release: Optional[Release],
    event: BaseEvent,
    groups: Sequence[GroupInfo],
) -> None:
    if release:
        for group_info in groups:
            group_info.group_release = GroupRelease.get_or_create(
                group=group_info.group,
                release=release,
                environment=environment,
                datetime=event.datetime,
            )


@metrics.wraps("save_event.tsdb_record_all_metrics")
def _tsdb_record_all_metrics(jobs: Sequence[Job]) -> None:
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
        release = job["release"]
        environment = job["environment"]
        user = job["user"]

        for group_info in job["groups"]:
            incrs.append((tsdb.models.group, group_info.group.id))
            frequencies.append(
                (
                    tsdb.models.frequent_environments_by_group,
                    {group_info.group.id: {environment.id: 1}},
                )
            )

            if group_info.group_release:
                frequencies.append(
                    (
                        tsdb.models.frequent_releases_by_group,
                        {group_info.group.id: {group_info.group_release.id: 1}},
                    )
                )
            if user:
                records.append(
                    (tsdb.models.users_affected_by_group, group_info.group.id, (user.tag_value,))
                )

        if release:
            incrs.append((tsdb.models.release, release.id))

        if user:
            project_id = job["project_id"]
            records.append((tsdb.models.users_affected_by_project, project_id, (user.tag_value,)))

        if incrs:
            tsdb.incr_multi(incrs, timestamp=event.datetime, environment_id=environment.id)

        if records:
            tsdb.record_multi(records, timestamp=event.datetime, environment_id=environment.id)

        if frequencies:
            tsdb.record_frequency_multi(frequencies, timestamp=event.datetime)


@metrics.wraps("save_event.nodestore_save_many")
def _nodestore_save_many(jobs: Sequence[Job]) -> None:
    inserted_time = datetime.utcnow().replace(tzinfo=UTC).timestamp()
    for job in jobs:
        # Write the event to Nodestore
        subkeys = {}

        event = job["event"]
        # We only care about `unprocessed` for error events
        if event.get_event_type() not in ("transaction", "generic") and job["groups"]:
            unprocessed = event_processing_store.get(
                cache_key_for_event({"project": event.project_id, "event_id": event.event_id}),
                unprocessed=True,
            )
            if unprocessed is not None:
                subkeys["unprocessed"] = unprocessed

        job["event"].data["nodestore_insert"] = inserted_time
        job["event"].data.save(subkeys=subkeys)


@metrics.wraps("save_event.eventstream_insert_many")
def _eventstream_insert_many(jobs: Sequence[Job]) -> None:
    for job in jobs:
        if job["event"].project_id == settings.SENTRY_PROJECT:
            metrics.incr(
                "internal.captured.eventstream_insert",
                tags={"event_type": job["event"].data.get("type") or "null"},
            )

        # XXX: Temporary hack so that we keep this group info working for error issues. We'll need
        # to change the format of eventstream to be able to handle data for multiple groups
        if not job["groups"]:
            group_states = None
            is_new = False
            is_regression = False
            is_new_group_environment = False
        else:
            # error issues
            group_info = job["groups"][0]
            is_new = group_info.is_new
            is_regression = group_info.is_regression
            is_new_group_environment = group_info.is_new_group_environment

            # performance issues with potentially multiple groups to a transaction
            group_states = [
                {
                    "id": gi.group.id,
                    "is_new": gi.is_new,
                    "is_regression": gi.is_regression,
                    "is_new_group_environment": gi.is_new_group_environment,
                }
                for gi in job["groups"]
                if gi is not None
            ]

        eventstream.insert(
            event=job["event"],
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            primary_hash=job["event"].get_primary_hash(),
            received_timestamp=job["received_timestamp"],
            # We are choosing to skip consuming the event back
            # in the eventstream if it's flagged as raw.
            # This means that we want to publish the event
            # through the event stream, but we don't care
            # about post processing and handling the commit.
            skip_consume=job.get("raw", False),
            group_states=group_states,
        )


@metrics.wraps("save_event.track_outcome_accepted_many")
def _track_outcome_accepted_many(jobs: Sequence[Job]) -> None:
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
def _get_event_instance(data: Mapping[str, Any], project_id: int) -> Event:
    event_id = data.get("event_id")

    return eventstore.create_event(
        project_id=project_id,
        event_id=event_id,
        group_id=None,
        data=EventDict(data, skip_renormalization=True),
    )


def _get_event_user(project: Project, data: Mapping[str, Any]) -> Optional[EventUser]:
    with metrics.timer("event_manager.get_event_user") as metrics_tags:
        return _get_event_user_impl(project, data, metrics_tags)


def _get_event_user_impl(
    project: Project, data: Mapping[str, Any], metrics_tags: MutableTags
) -> Optional[EventUser]:
    user_data = data.get("user")
    if not user_data:
        metrics_tags["event_has_user"] = "false"
        return None

    metrics_tags["event_has_user"] = "true"

    ip_address = user_data.get("ip_address")

    if ip_address:
        try:
            ipaddress.ip_address(str(ip_address))
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
        return None

    cache_key = f"euserid:1:{project.id}:{euser.hash}"
    euser_id = cache.get(cache_key)
    if euser_id is None:
        metrics_tags["cache_hit"] = "false"

        try:
            euser, created = EventUser.objects.get_or_create(
                project_id=euser.project_id,
                hash=euser.hash,
                defaults={
                    "ident": euser.ident,
                    "email": euser.email,
                    "username": euser.username,
                    "ip_address": euser.ip_address,
                    "name": euser.name,
                },
            )
        except IntegrityError:
            # TODO(michal): This is result of project_id, ident duplicate and
            # should not be possible since we prioritize ident for hash
            created = False
            cache.set(cache_key, -1, 3600)
        else:
            if not created and user_data.get("name") and euser.name != user_data.get("name"):
                euser.update(name=user_data["name"])
            cache.set(cache_key, euser.id, 3600)

        metrics_tags["created"] = str(created).lower()
    else:
        metrics_tags["cache_hit"] = "true"

    return euser


EventType = Union[
    DefaultEvent,
    ErrorEvent,
    CspEvent,
    HpkpEvent,
    ExpectCTEvent,
    ExpectStapleEvent,
    TransactionEvent,
]


def get_event_type(data: Mapping[str, Any]) -> EventType:
    return eventtypes.get(data.get("type", "default"))()


EventMetadata = Dict[str, Any]


def materialize_metadata(
    data: Mapping[str, Any], event_type: EventType, event_metadata: Mapping[str, Any]
) -> EventMetadata:
    """Returns the materialized metadata to be merged with group or
    event data.  This currently produces the keys `type`, `culprit`,
    `metadata`, `title` and `location`.
    """

    # XXX(markus): Ideally this wouldn't take data or event_type, and instead
    # calculate culprit + type from event_metadata

    return {
        "type": event_type.key,
        "culprit": get_culprit(data),
        "metadata": event_metadata,
        "title": event_type.get_title(event_metadata),
        "location": event_type.get_location(event_metadata),
    }


def inject_performance_problem_metadata(
    metadata: dict[str, Any], problem: PerformanceProblem
) -> dict[str, Any]:
    metadata["value"] = problem.desc
    metadata["title"] = problem.title
    return metadata


def get_culprit(data: Mapping[str, Any]) -> str:
    """Helper to calculate the default culprit"""
    return str(
        force_text(data.get("culprit") or data.get("transaction") or generate_culprit(data) or "")
    )


def _save_aggregate(
    event: Event,
    hashes: CalculatedHashes,
    release: Optional[Release],
    metadata: dict[str, Any],
    received_timestamp: Union[int, float],
    migrate_off_hierarchical: Optional[bool] = False,
    **kwargs: dict[str, Any],
) -> Optional[GroupInfo]:
    project = event.project

    flat_grouphashes = [
        GroupHash.objects.get_or_create(project=project, hash=hash)[0] for hash in hashes.hashes
    ]

    # The root_hierarchical_hash is the least specific hash within the tree, so
    # typically hierarchical_hashes[0], unless a hash `n` has been split in
    # which case `root_hierarchical_hash = hierarchical_hashes[n + 1]`. Chosing
    # this for select_for_update mostly provides sufficient synchronization
    # when groups are created and also relieves contention by locking a more
    # specific hash than `hierarchical_hashes[0]`.
    existing_grouphash, root_hierarchical_hash = _find_existing_grouphash(
        project, flat_grouphashes, hashes.hierarchical_hashes
    )

    if root_hierarchical_hash is not None:
        root_hierarchical_grouphash = GroupHash.objects.get_or_create(
            project=project, hash=root_hierarchical_hash
        )[0]

        metadata.update(
            hashes.group_metadata_from_hash(
                existing_grouphash.hash
                if existing_grouphash is not None
                else root_hierarchical_hash
            )
        )

    else:
        root_hierarchical_grouphash = None

    # In principle the group gets the same metadata as the event, so common
    # attributes can be defined in eventtypes.
    #
    # Additionally the `last_received` key is set for group metadata, later in
    # _save_aggregate
    kwargs["data"] = materialize_metadata(
        event.data,
        get_event_type(event.data),
        metadata,
    )
    kwargs["data"]["last_received"] = received_timestamp

    if existing_grouphash is None:

        if killswitch_matches_context(
            "store.load-shed-group-creation-projects",
            {
                "project_id": project.id,
                "platform": event.platform,
            },
        ):
            raise HashDiscarded("Load shedding group creation", reason="load_shed")

        with sentry_sdk.start_span(
            op="event_manager.create_group_transaction"
        ) as span, metrics.timer(
            "event_manager.create_group_transaction"
        ) as metric_tags, transaction.atomic():
            span.set_tag("create_group_transaction.outcome", "no_group")
            metric_tags["create_group_transaction.outcome"] = "no_group"

            all_hash_ids = [h.id for h in flat_grouphashes]
            if root_hierarchical_grouphash is not None:
                all_hash_ids.append(root_hierarchical_grouphash.id)

            all_hashes = list(GroupHash.objects.filter(id__in=all_hash_ids).select_for_update())

            flat_grouphashes = [gh for gh in all_hashes if gh.hash in hashes.hashes]

            existing_grouphash, root_hierarchical_hash = _find_existing_grouphash(
                project, flat_grouphashes, hashes.hierarchical_hashes
            )

            if root_hierarchical_hash is not None:
                root_hierarchical_grouphash = GroupHash.objects.get_or_create(
                    project=project, hash=root_hierarchical_hash
                )[0]
            else:
                root_hierarchical_grouphash = None

            if existing_grouphash is None:

                group = _create_group(project, event, **kwargs)

                if root_hierarchical_grouphash is not None:
                    new_hashes = [root_hierarchical_grouphash]
                else:
                    new_hashes = list(flat_grouphashes)

                GroupHash.objects.filter(id__in=[h.id for h in new_hashes]).exclude(
                    state=GroupHash.State.LOCKED_IN_MIGRATION
                ).update(group=group)

                is_new = True
                is_regression = False

                span.set_tag("create_group_transaction.outcome", "new_group")
                metric_tags["create_group_transaction.outcome"] = "new_group"

                metrics.incr(
                    "group.created",
                    skip_internal=True,
                    tags={"platform": event.platform or "unknown"},
                )

                return GroupInfo(group, is_new, is_regression)

    group = Group.objects.get(id=existing_grouphash.group_id)
    if group.issue_category != GroupCategory.ERROR:
        logger.info(
            "event_manager.category_mismatch",
            extra={
                "issue_category": group.issue_category,
                "event_type": "error",
            },
        )
        return None

    is_new = False

    # For the migration from hierarchical to non hierarchical we want to associate
    # all group hashes
    if migrate_off_hierarchical:
        new_hashes = [h for h in flat_grouphashes if h.group_id is None]
        if root_hierarchical_grouphash and root_hierarchical_grouphash.group_id is None:
            new_hashes.append(root_hierarchical_grouphash)
    elif root_hierarchical_grouphash is None:
        # No hierarchical grouping was run, only consider flat hashes
        new_hashes = [h for h in flat_grouphashes if h.group_id is None]
    elif root_hierarchical_grouphash.group_id is None:
        # The root hash is not assigned to a group.
        # We ran multiple grouping algorithms
        # (see secondary grouping), and the hierarchical hash is new
        new_hashes = [root_hierarchical_grouphash]
    else:
        new_hashes = []

    if new_hashes:
        # There may still be secondary hashes that we did not use to find an
        # existing group. A classic example is when grouping makes changes to
        # the app-hash (changes to in_app logic), but the system hash stays
        # stable and is used to find an existing group. Associate any new
        # hashes with the group such that event saving continues to be
        # resilient against grouping algorithm changes.
        #
        # There is a race condition here where two processes could "steal"
        # hashes from each other. In practice this should not be user-visible
        # as group creation is synchronized. Meaning the only way hashes could
        # jump between groups is if there were two processes that:
        #
        # 1) have BOTH found an existing group
        #    (otherwise at least one of them would be in the group creation
        #    codepath which has transaction isolation/acquires row locks)
        # 2) AND are looking at the same set, or an overlapping set of hashes
        #    (otherwise they would not operate on the same rows)
        # 3) yet somehow also sort their event into two different groups each
        #    (otherwise the update would not change anything)
        #
        # We think this is a very unlikely situation. A previous version of
        # _save_aggregate had races around group creation which made this race
        # more user visible. For more context, see 84c6f75a and d0e22787, as
        # well as GH-5085.
        GroupHash.objects.filter(id__in=[h.id for h in new_hashes]).exclude(
            state=GroupHash.State.LOCKED_IN_MIGRATION
        ).update(group=group)

    is_regression = _process_existing_aggregate(
        group=group, event=event, data=kwargs, release=release
    )

    return GroupInfo(group, is_new, is_regression)


def _find_existing_grouphash(
    project: Project,
    flat_grouphashes: Sequence[GroupHash],
    hierarchical_hashes: Optional[Sequence[str]],
) -> tuple[Optional[GroupHash], Optional[str]]:
    all_grouphashes = []
    root_hierarchical_hash = None

    found_split = False

    if hierarchical_hashes:
        hierarchical_grouphashes = {
            h.hash: h
            for h in GroupHash.objects.filter(project=project, hash__in=hierarchical_hashes)
        }

        # Look for splits:
        # 1. If we find a hash with SPLIT state at `n`, we want to use
        #    `n + 1` as the root hash.
        # 2. If we find a hash associated to a group that is more specific
        #    than the primary hash, we want to use that hash as root hash.
        for hash in reversed(hierarchical_hashes):
            group_hash = hierarchical_grouphashes.get(hash)

            if group_hash is not None and group_hash.state == GroupHash.State.SPLIT:
                found_split = True
                break

            root_hierarchical_hash = hash

            if group_hash is not None:
                all_grouphashes.append(group_hash)

                if group_hash.group_id is not None:
                    # Even if we did not find a hash with SPLIT state, we want to use
                    # the most specific hierarchical hash as root hash if it was already
                    # associated to a group.
                    # See `move_all_events` test case
                    break

        if root_hierarchical_hash is None:
            # All hashes were split, so we group by most specific hash. This is
            # a legitimate usecase when there are events whose stacktraces are
            # suffixes of other event's stacktraces.
            root_hierarchical_hash = hierarchical_hashes[-1]
            group_hash = hierarchical_grouphashes.get(root_hierarchical_hash)

            if group_hash is not None:
                all_grouphashes.append(group_hash)

    if not found_split:
        # In case of a split we want to avoid accidentally finding the split-up
        # group again via flat hashes, which are very likely associated with
        # whichever group is attached to the split hash. This distinction will
        # become irrelevant once we start moving existing events into child
        # groups and delete the parent group.
        all_grouphashes.extend(flat_grouphashes)

    for group_hash in all_grouphashes:
        if group_hash.group_id is not None:
            return group_hash, root_hierarchical_hash

        # When refactoring for hierarchical grouping, we noticed that a
        # tombstone may get ignored entirely if there is another hash *before*
        # that happens to have a group_id. This bug may not have been noticed
        # for a long time because most events only ever have 1-2 hashes. It
        # will definitely get more noticeable with hierarchical grouping and
        # it's not clear what good behavior would look like. Do people want to
        # be able to tombstone `hierarchical_hashes[4]` while still having a
        # group attached to `hierarchical_hashes[0]`? Maybe.
        if group_hash.group_tombstone_id is not None:
            raise HashDiscarded(
                "Matches group tombstone %s" % group_hash.group_tombstone_id,
                reason="discard",
                tombstone_id=group_hash.group_tombstone_id,
            )

    return None, root_hierarchical_hash


def _create_group(project: Project, event: Event, **kwargs: dict[str, Any]) -> Group:
    try:
        short_id = project.next_short_id()
    except OperationalError:
        metrics.incr(
            "next_short_id.timeout",
            tags={"platform": event.platform or "unknown"},
        )
        sentry_sdk.capture_message("short_id.timeout")
        raise HashDiscarded("Timeout when getting next_short_id", reason="timeout")

    # it's possible the release was deleted between
    # when we queried for the release and now, so
    # make sure it still exists
    first_release = kwargs.pop("first_release", None)
    first_release_id = (
        Release.objects.filter(id=cast(Release, first_release).id)
        .values_list("id", flat=True)
        .first()
        if first_release
        else None
    )

    return Group.objects.create(
        project=project,
        short_id=short_id,
        first_release_id=first_release_id,
        **kwargs,
    )


def _handle_regression(group: Group, event: Event, release: Optional[Release]) -> Optional[bool]:
    if not group.is_resolved():
        return None

    # we only mark it as a regression if the event's release is newer than
    # the release which we originally marked this as resolved
    elif GroupResolution.has_resolution(group, release):
        return None

    elif has_pending_commit_resolution(group):
        return None

    if not plugin_is_regression(group, event):
        return None

    # we now think its a regression, rely on the database to validate that
    # no one beat us to this
    date = max(event.datetime, group.last_seen)
    is_regression = bool(
        Group.objects.filter(
            id=group.id,
            # ensure we can't update things if the status has been set to
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
            substatus=GroupSubStatus.REGRESSED,
        )
    )
    issue_unresolved.send_robust(
        project=group.project,
        user=None,
        group=group,
        transition_type="automatic",
        sender="handle_regression",
    )

    group.active_at = date
    group.status = GroupStatus.UNRESOLVED
    group.substatus = GroupSubStatus.REGRESSED

    if is_regression and release:
        resolution = None

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

        if affected and resolution:
            # if we had to remove the GroupResolution (i.e. we beat the
            # the queue to handling this) then we need to also record
            # the corresponding event
            try:
                activity = Activity.objects.filter(
                    group=group,
                    type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
                    ident=resolution.id,
                ).order_by("-datetime")[0]
            except IndexError:
                # XXX: handle missing data, as its not overly important
                pass
            else:
                try:
                    # We should only update last activity version prior to the regression in the
                    # case where we have "Resolved in upcoming release" i.e. version == ""
                    # We also should not override the `data` attribute here because it might have
                    # a `current_release_version` for semver releases and we wouldn't want to
                    # lose that
                    if activity.data["version"] == "":
                        activity.update(data={**activity.data, "version": release.version})
                except KeyError:
                    # Safeguard in case there is no "version" key. However, should not happen
                    activity.update(data={"version": release.version})

    if is_regression:
        Activity.objects.create_group_activity(
            group,
            ActivityType.SET_REGRESSION,
            data={"version": release.version if release else "", "event_id": event.event_id},
        )
        record_group_history(group, GroupHistoryStatus.REGRESSED, actor=None, release=release)

        kick_off_status_syncs.apply_async(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )

    return is_regression


def _process_existing_aggregate(
    group: Group, event: Event, data: Mapping[str, Any], release: Optional[Release]
) -> bool:
    date = max(event.datetime, group.last_seen)
    extra = {"last_seen": date, "data": data["data"]}
    if (
        event.search_message
        and event.search_message != group.message
        and event.get_event_type() != TransactionEvent.key
    ):
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

    buffer_incr(Group, update_kwargs, {"id": group.id}, extra)

    return bool(is_regression)


Attachment = Type[CachedAttachment]


def discard_event(job: Job, attachments: Sequence[Attachment]) -> None:
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
        "events.discarded",
        skip_internal=True,
        tags={"platform": job["platform"]},
    )


def get_attachments(cache_key: Optional[str], job: Job) -> list[Attachment]:
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


def filter_attachments_for_group(attachments: list[Attachment], job: Job) -> list[Attachment]:
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

    max_crashreports = cast(
        int, max_crashreports
    )  # this is safe since the second call doesn't allow None

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
    cache_key: Optional[str],
    attachment: Attachment,
    project: Project,
    event_id: str,
    key_id: Optional[int] = None,
    group_id: Optional[int] = None,
    start_time: Optional[Union[float, int]] = None,
) -> None:
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
    file.putfile(BytesIO(data), blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE)

    EventAttachment.objects.create(
        event_id=event_id,
        project_id=project.id,
        group_id=group_id,
        name=attachment.name,
        file_id=file.id,
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


def save_attachments(cache_key: Optional[str], attachments: list[Attachment], job: Job) -> None:
    """
    Persists cached event attachments into the file store.

    Emits one outcome per attachment, either ACCEPTED on success or
    INVALID(missing_chunks) if retrieving the attachment fails.
    :param cache_key:  The cache key at which the attachment is stored for
                       debugging purposes.
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


@metrics.wraps("event_manager.save_transactions.materialize_event_metrics")
def _materialize_event_metrics(jobs: Sequence[Job]) -> None:
    for job in jobs:
        # Ensure the _metrics key exists. This is usually created during
        # and prefilled with ingestion sizes.
        event_metrics = job["event"].data.get("_metrics") or {}
        job["event"].data["_metrics"] = event_metrics

        # Capture the actual size that goes into node store.
        event_metrics["bytes.stored.event"] = len(json.dumps(dict(job["event"].data.items())))

        for metric_name in ("flag.processing.error", "flag.processing.fatal"):
            if event_metrics.get(metric_name):
                metrics.incr(f"event_manager.save.event_metrics.{metric_name}")

        job["event_metrics"] = event_metrics


@metrics.wraps("save_event.calculate_event_grouping")
def _calculate_event_grouping(
    project: Project, event: Event, grouping_config: GroupingConfig
) -> CalculatedHashes:
    """
    Main entrypoint for modifying/enhancing and grouping an event, writes
    hashes back into event payload.
    """
    metric_tags = {
        "grouping_config": grouping_config["id"],
        "platform": event.platform or "unknown",
    }

    with metrics.timer("event_manager.normalize_stacktraces_for_grouping", tags=metric_tags):
        with sentry_sdk.start_span(op="event_manager.normalize_stacktraces_for_grouping"):
            event.normalize_stacktraces_for_grouping(load_grouping_config(grouping_config))

    # Detect & set synthetic marker if necessary
    detect_synthetic_exception(event.data, grouping_config)

    with metrics.timer("event_manager.apply_server_fingerprinting"):
        # The active grouping config was put into the event in the
        # normalize step before.  We now also make sure that the
        # fingerprint was set to `'{{ default }}' just in case someone
        # removed it from the payload.  The call to get_hashes will then
        # look at `grouping_config` to pick the right parameters.
        event.data["fingerprint"] = event.data.data.get("fingerprint") or ["{{ default }}"]
        apply_server_fingerprinting(
            event.data.data,
            get_fingerprinting_config_for_project(project),
            allow_custom_title=True,
        )

    with metrics.timer("event_manager.event.get_hashes", tags=metric_tags):
        # Here we try to use the grouping config that was requested in the
        # event.  If that config has since been deleted (because it was an
        # experimental grouping config) we fall back to the default.
        try:
            hashes = event.get_hashes(grouping_config)
        except GroupingConfigNotFound:
            event.data["grouping_config"] = get_grouping_config_dict_for_project(project)
            hashes = event.get_hashes()

    hashes.write_to_event(event.data)
    return cast(CalculatedHashes, hashes)


@metrics.wraps("save_event.calculate_span_grouping")
def _calculate_span_grouping(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        # Make sure this snippet doesn't crash ingestion
        # as the feature is under development.
        try:
            event = job["event"]
            with metrics.timer("event_manager.save.get_span_groupings.default"):
                groupings = event.get_span_groupings()
            groupings.write_to_event(event.data)

            metrics.timing("save_event.transaction.span_count", len(groupings.results))
            unique_default_hashes = set(groupings.results.values())
            metrics.incr(
                "save_event.transaction.span_group_count.default",
                amount=len(unique_default_hashes),
                tags={"platform": job["platform"] or "unknown"},
            )
        except Exception:
            sentry_sdk.capture_exception()


@metrics.wraps("save_event.detect_performance_problems")
def _detect_performance_problems(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        job["performance_problems"] = detect_performance_problems(
            job["data"], projects[job["project_id"]]
        )


class PerformanceJob(TypedDict, total=False):
    performance_problems: Sequence[PerformanceProblem]
    event: Event
    groups: list[GroupInfo]
    culprit: str
    received_timestamp: float
    event_metadata: Mapping[str, Any]
    platform: str
    level: str
    logger_name: str
    release: Release


def _save_grouphash_and_group(
    project: Project, event: Event, new_grouphash: str, **group_kwargs: dict[str, Any]
) -> Tuple[Group, bool]:
    group = None
    with transaction.atomic():
        group_hash, created = GroupHash.objects.get_or_create(project=project, hash=new_grouphash)
        if created:
            group = _create_group(project, event, **group_kwargs)
            group_hash.update(group=group)

    if group is None:
        # If we failed to create the group it means another worker beat us to
        # it. Since a GroupHash can only be created in a transaction with the
        # Group, we can guarantee that the Group will exist at this point and
        # fetch it via GroupHash
        group = Group.objects.get(grouphash__project=project, grouphash__hash=new_grouphash)
    return group, created


def _message_from_metadata(meta: Mapping[str, str]) -> str:
    title = meta.get("title", "")
    location = meta.get("location", "")
    separator = ": " if title and location else ""
    return f"{title}{separator}{location}"


@metrics.wraps("save_event.save_aggregate_performance")
def _save_aggregate_performance(jobs: Sequence[PerformanceJob], projects: ProjectsMapping) -> None:
    MAX_GROUPS = (
        10  # safety check in case we are passed too many. constant will live somewhere else tbd
    )
    for job in jobs:
        job["groups"] = []
        hashes = []
        event = job["event"]
        project = event.project

        # Granular, per-project option
        per_project_rate = project.get_option("sentry:performance_issue_creation_rate", 1.0)
        if per_project_rate > random.random():
            kwargs = _create_kwargs(job)
            kwargs["culprit"] = job["culprit"]
            kwargs["data"] = materialize_metadata(
                event.data,
                get_event_type(event.data),
                dict(job["event_metadata"]),
            )
            kwargs["data"]["last_received"] = job["received_timestamp"]

            all_performance_problems = job["performance_problems"]

            # Filter out performance problems that will be later sent to the issues platform
            performance_problems = [
                problem
                for problem in all_performance_problems
                if not can_create_group(problem, project)
            ]
            for problem in performance_problems:
                problem.fingerprint = md5(problem.fingerprint.encode("utf-8")).hexdigest()

            performance_problems_by_hash = {p.fingerprint: p for p in performance_problems}
            all_group_hashes = [problem.fingerprint for problem in performance_problems]
            group_hashes = all_group_hashes[:MAX_GROUPS]

            existing_grouphashes = GroupHash.objects.filter(
                project=project, hash__in=group_hashes
            ).select_related("group")

            new_grouphashes = set(group_hashes) - {hash.hash for hash in existing_grouphashes}

            if new_grouphashes:
                # limits group creation to grouphashes seen multiple times over a specified time window
                if settings.SENTRY_PERFORMANCE_ISSUES_REDUCE_NOISE:
                    new_grouphashes = reduce_noise(
                        new_grouphashes, performance_problems_by_hash, project
                    )

                new_grouphashes_count = len(new_grouphashes)

                with metrics.timer("performance.performance_issue.check_write_limits"):
                    granted_quota = issue_rate_limiter.check_and_use_quotas(
                        [
                            RequestedQuota(
                                f"performance-issues:{project.id}",
                                new_grouphashes_count,
                                [PERFORMANCE_ISSUE_QUOTA],
                            )
                        ]
                    )[0]

                # Log how many groups didn't get created because of rate limiting
                _dropped_group_hash_count = new_grouphashes_count - granted_quota.granted
                metrics.incr("performance.performance_issue.dropped", _dropped_group_hash_count)

                for new_grouphash in list(new_grouphashes)[: granted_quota.granted]:
                    # GROUP DOES NOT EXIST
                    with sentry_sdk.start_span(
                        op="event_manager.create_performance_group_transaction"
                    ) as span, metrics.timer(
                        "event_manager.create_performance_group_transaction",
                        tags={"platform": event.platform or "unknown"},
                        sample_rate=1.0,
                    ) as metric_tags, transaction.atomic():
                        problem = performance_problems_by_hash[new_grouphash]

                        span.set_tag("create_group_transaction.outcome", "no_group")
                        span.set_tag("group_type", problem.type.slug)
                        metric_tags["create_group_transaction.outcome"] = "no_group"
                        metric_tags["group_type"] = problem.type.slug.upper()

                        group_kwargs = kwargs.copy()
                        group_kwargs["type"] = problem.type.type_id

                        group_kwargs["data"]["metadata"] = inject_performance_problem_metadata(
                            group_kwargs["data"]["metadata"], problem
                        )

                        if group_kwargs["data"]["metadata"]:
                            group_kwargs["message"] = _message_from_metadata(
                                group_kwargs["data"]["metadata"]
                            )

                        group, is_new = _save_grouphash_and_group(
                            project, event, new_grouphash, **group_kwargs
                        )

                        is_regression = False

                        span.set_tag("create_group_transaction.outcome", "new_group")
                        metric_tags["create_group_transaction.outcome"] = "new_group"

                        metrics.incr(
                            "group.created",
                            skip_internal=True,
                            tags={"platform": job["platform"] or "unknown"},
                        )

                        job["groups"].append(
                            GroupInfo(group=group, is_new=is_new, is_regression=is_regression)
                        )
                        hashes.append(new_grouphash)

            if existing_grouphashes:

                # GROUP EXISTS
                for existing_grouphash in existing_grouphashes:
                    group = existing_grouphash.group
                    if group.issue_category != GroupCategory.PERFORMANCE:
                        logger.info(
                            "event_manager.category_mismatch",
                            extra={
                                "issue_category": group.issue_category,
                                "event_type": "performance",
                            },
                        )
                        continue

                    is_new = False

                    problem = performance_problems_by_hash[existing_grouphash.hash]
                    group_kwargs = kwargs.copy()
                    group_kwargs["data"]["metadata"] = inject_performance_problem_metadata(
                        group_kwargs["data"]["metadata"], problem
                    )
                    if group_kwargs["data"]["metadata"].get("title"):
                        group_kwargs["message"] = _message_from_metadata(
                            group_kwargs["data"]["metadata"]
                        )

                    is_regression = _process_existing_aggregate(
                        group=group, event=job["event"], data=group_kwargs, release=job["release"]
                    )

                    job["groups"].append(
                        GroupInfo(group=group, is_new=is_new, is_regression=is_regression)
                    )
                    hashes.append(existing_grouphash.hash)

            job["event"].groups = [group_info.group for group_info in job["groups"]]
            job["event"].data["hashes"] = hashes
            for problem_hash in hashes:
                EventPerformanceProblem(event, performance_problems_by_hash[problem_hash]).save()


@metrics.wraps("save_event.send_occurrence_to_platform")
def _send_occurrence_to_platform(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        event = job["event"]
        project = event.project
        event_id = event.event_id

        performance_problems = job["performance_problems"]
        for problem in performance_problems:
            if write_occurrence_to_platform(problem, project):
                occurrence = IssueOccurrence(
                    id=uuid.uuid4().hex,
                    resource_id=None,
                    project_id=project.id,
                    event_id=event_id,
                    fingerprint=[problem.fingerprint],
                    type=problem.type,
                    issue_title=problem.title,
                    subtitle=problem.desc,
                    culprit=event.transaction,
                    evidence_data=problem.evidence_data,
                    evidence_display=problem.evidence_display,
                    detection_time=event.datetime,
                    level=job["level"],
                )

                produce_occurrence_to_kafka(occurrence)


@metrics.wraps("event_manager.save_transaction_events")
def save_transaction_events(jobs: Sequence[Job], projects: ProjectsMapping) -> Sequence[Job]:
    with metrics.timer("event_manager.save_transactions.collect_organization_ids"):
        organization_ids = {project.organization_id for project in projects.values()}

    with metrics.timer("event_manager.save_transactions.fetch_organizations"):
        organizations = {
            o.id: o for o in Organization.objects.get_many_from_cache(organization_ids)
        }

    with metrics.timer("event_manager.save_transactions.set_organization_cache"):
        for project in projects.values():
            try:
                project.set_cached_field_value(
                    "organization", organizations[project.organization_id]
                )
            except KeyError:
                continue

    _pull_out_data(jobs, projects)
    _get_or_create_release_many(jobs, projects)
    _get_event_user_many(jobs, projects)
    _derive_plugin_tags_many(jobs, projects)
    _derive_interface_tags_many(jobs)
    _calculate_span_grouping(jobs, projects)
    _detect_performance_problems(jobs, projects)
    _materialize_metadata_many(jobs)
    _save_aggregate_performance(jobs, projects)  # type: ignore
    _get_or_create_environment_many(jobs, projects)
    _get_or_create_group_environment_many(jobs, projects)
    _get_or_create_release_associated_models(jobs, projects)
    _increment_release_associated_counts_many(jobs, projects)
    _get_or_create_group_release_many(jobs, projects)
    _tsdb_record_all_metrics(jobs)
    _materialize_event_metrics(jobs)
    _nodestore_save_many(jobs)
    _eventstream_insert_many(jobs)
    _track_outcome_accepted_many(jobs)
    _send_occurrence_to_platform(jobs, projects)
    return jobs


@metrics.wraps("event_manager.save_generic_events")
def save_generic_events(jobs: Sequence[Job], projects: ProjectsMapping) -> Sequence[Job]:
    with metrics.timer("event_manager.save_generic.organization_ids"):
        organization_ids = {project.organization_id for project in projects.values()}

    with metrics.timer("event_manager.save_generic.fetch_organizations"):
        organizations = {
            o.id: o for o in Organization.objects.get_many_from_cache(organization_ids)
        }

    with metrics.timer("event_manager.save_generic.set_organization_cache"):
        for project in projects.values():
            try:
                project.set_cached_field_value(
                    "organization", organizations[project.organization_id]
                )
            except KeyError:
                continue

    _pull_out_data(jobs, projects)
    _get_or_create_release_many(jobs, projects)
    _get_event_user_many(jobs, projects)
    _derive_plugin_tags_many(jobs, projects)
    _derive_interface_tags_many(jobs)
    _materialize_metadata_many(jobs)
    _get_or_create_environment_many(jobs, projects)
    _materialize_event_metrics(jobs)
    _nodestore_save_many(jobs)

    return jobs
