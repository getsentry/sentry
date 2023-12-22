from __future__ import annotations

import copy
import ipaddress
import logging
import mimetypes
import random
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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
    TypedDict,
    Union,
    cast,
)

import sentry_sdk
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import OperationalError, connection, router, transaction
from django.db.models import Func
from django.db.models.signals import post_save
from django.utils.encoding import force_str
from urllib3 import Retry
from urllib3.exceptions import MaxRetryError
from usageaccountant import UsageUnit

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
from sentry.conf.server import SEVERITY_DETECTION_RETRIES
from sentry.constants import (
    DEFAULT_STORE_NORMALIZER_ARGS,
    LOG_LEVELS_MAP,
    MAX_TAG_VALUE_LENGTH,
    DataCategory,
)
from sentry.culprit import generate_culprit
from sentry.dynamic_sampling import LatestReleaseBias, LatestReleaseParams
from sentry.eventstore.processing import event_processing_store
from sentry.eventtypes import EventType
from sentry.eventtypes.transaction import TransactionEvent
from sentry.exceptions import HashDiscarded
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
from sentry.grouping.ingest import update_grouping_config_if_needed
from sentry.grouping.result import CalculatedHashes
from sentry.ingest.inbound_filters import FilterStatKeys
from sentry.issues.grouptype import GroupCategory
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.killswitches import killswitch_matches_context
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL, convert_crashreport_count
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.event import EventDict
from sentry.models.eventattachment import CRASH_REPORT_TYPES, EventAttachment, get_crashreport_key
from sentry.models.files.file import File
from sentry.models.group import Group, GroupStatus
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouphash import GroupHash
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.grouplink import GroupLink
from sentry.models.grouprelease import GroupRelease
from sentry.models.groupresolution import GroupResolution
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.models.pullrequest import PullRequest
from sentry.models.release import Release, ReleaseProject, follows_semver_versioning_scheme
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.userreport import UserReport
from sentry.net.http import connection_from_url
from sentry.plugins.base import plugins
from sentry.quotas.base import index_data_category
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
from sentry.tsdb.base import TSDBModel
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.usage_accountant import record
from sentry.utils import json, metrics
from sentry.utils.cache import cache_key_for_event
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.event import has_event_minified_stack_trace, has_stacktrace, is_handled
from sentry.utils.eventuser import EventUser
from sentry.utils.metrics import MutableTags
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.performance_issues.performance_detection import detect_performance_problems
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.utils.safe import get_path, safe_execute, setdefault_path, trim
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

if TYPE_CHECKING:
    from sentry.eventstore.models import BaseEvent, Event

logger = logging.getLogger("sentry.events")

SECURITY_REPORT_INTERFACES = ("csp", "hpkp", "expectct", "expectstaple", "nel")

# Timeout for cached group crash report counts
CRASH_REPORT_TIMEOUT = 24 * 3600  # one day

NON_TITLE_EVENT_TITLES = ["<untitled>", "<unknown>", "<unlabeled event>", "Error"]


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


def is_sample_event(job):
    return get_tag(job["data"], "sample_event") == "yes"


def sdk_metadata_from_event(event: Event) -> Mapping[str, Any]:
    """
    Returns a metadata dictionary with "sdk" field populated, including a normalized name
    Returns {} when event type of event is known to not be SDK generated.
    """

    if event.get_event_type() in SECURITY_REPORT_INTERFACES:
        return {}

    if not (sdk_metadata := event.data.get("sdk")):
        return {}

    try:
        return {
            "sdk": {
                "name": sdk_metadata.get("name") or "unknown",
                "name_normalized": normalized_sdk_tag_from_event(event),
            }
        }
    except Exception:
        logger.warning("failed to set normalized SDK name", exc_info=True)
        return {}


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
    return convert_crashreport_count(value, allow_none=allow_none)


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
        return cached_reports

    # Fall-through if max_crashreports was bumped to get a more accurate number.
    # We don't need the actual number, but just whether it's more or equal to
    # the currently allowed maximum.
    query = EventAttachment.objects.filter(group_id=event.group_id, type__in=CRASH_REPORT_TYPES)
    return query[:max_crashreports].count()


class ScoreClause(Func):
    def __init__(self, group=None, last_seen=None, times_seen=None, *args, **kwargs):
        self.group = group
        self.last_seen = last_seen
        self.times_seen = times_seen
        # times_seen is likely an F-object that needs the value extracted
        if hasattr(self.times_seen, "rhs"):
            self.times_seen = self.times_seen.rhs.value
        super().__init__(*args, **kwargs)

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
        if pre_normalize_type in ("generic", "feedback"):
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

        with metrics.timer("event_manager.save.organization.get_from_cache"):
            project.set_cached_field_value(
                "organization", Organization.objects.get_from_cache(id=project.organization_id)
            )

        projects = {project.id: project}

        job: dict[str, Any] = {
            "data": self._data,
            "project_id": project.id,
            "raw": raw,
            "start_time": start_time,
        }

        # After calling _pull_out_data we get some keys in the job like the platform
        with sentry_sdk.start_span(op="event_manager.save.pull_out_data"):
            _pull_out_data([job], projects)

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
        else:
            metric_tags = {
                "platform": job["event"].platform or "unknown",
                "sdk": normalized_sdk_tag_from_event(job["event"]),
            }
            # This metric allows differentiating from all calls to the `event_manager.save` metric
            # and adds support for differentiating based on platforms
            with metrics.timer("event_manager.save_error_events", tags=metric_tags):
                return self.save_error_events(project, job, projects, metric_tags, raw, cache_key)

    def save_error_events(
        self,
        project: Project,
        job: Job,
        projects: ProjectsMapping,
        metric_tags: MutableTags,
        raw: bool = False,
        cache_key: Optional[str] = None,
    ) -> Event:
        jobs = [job]

        if is_sample_event(job):
            logger.info(
                "save_error_events: processing sample event",
                extra={
                    "event.id": job["event"].event_id,
                    "project_id": project.id,
                    "sample_event": True,
                },
            )

        is_reprocessed = is_reprocessed_event(job["data"])

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

        # Background grouping is a way for us to get performance metrics for a new
        # config without having it actually affect on how events are grouped. It runs
        # either before or after the main grouping logic, depending on the option value.
        do_background_grouping_before = options.get("store.background-grouping-before")
        if do_background_grouping_before:
            _run_background_grouping(project, job)

        secondary_hashes = None
        migrate_off_hierarchical = False

        if _should_run_secondary_grouping(project):
            with metrics.timer("event_manager.secondary_grouping", tags=metric_tags):
                secondary_grouping_config = SecondaryGroupingConfigLoader().get_config_dict(project)
                secondary_hashes = _calculate_secondary_hash(
                    project, job, secondary_grouping_config
                )

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

        with sentry_sdk.start_span(
            op="event_manager",
            description="event_manager.save.calculate_event_grouping",
        ), metrics.timer("event_manager.calculate_event_grouping", tags=metric_tags):
            hashes = _calculate_primary_hash(project, job, grouping_config)

        if secondary_hashes:
            tags = {
                "primary_config": grouping_config["id"],
                "secondary_config": secondary_grouping_config["id"],
            }
            current_values = hashes.hashes
            secondary_values = secondary_hashes.hashes
            hashes_match = current_values == secondary_values

            if hashes_match:
                tags["result"] = "no change"
            else:
                shared_hashes = set(current_values) & set(secondary_values)
                if len(shared_hashes) > 0:
                    tags["result"] = "partial change"
                else:
                    tags["result"] = "full change"

            metrics.incr("grouping.hash_comparison", tags=tags)

        # Track the total number of grouping calculations done overall, so we can divide by the
        # count to get an average number of calculations per event
        metrics.incr("grouping.hashes_calculated", amount=2 if secondary_hashes else 1)

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

        group_creation_kwargs = _get_group_creation_kwargs(job)

        group_creation_kwargs["culprit"] = job["culprit"]

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
                    **group_creation_kwargs,
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
            if is_sample_event(job):
                logger.info(
                    "save_error_events: no groupinfo found, returning event",
                    extra={
                        "event.id": job["event"].event_id,
                        "project_id": project.id,
                        "sample_event": True,
                    },
                )
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

        _nodestore_save_many(jobs=jobs, app_feature="errors")
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

        metric_tags = {"from_relay": str("_relay_processed" in job["data"])}

        metrics.timing(
            "events.latency",
            job["received_timestamp"] - job["recorded_timestamp"],
            tags=metric_tags,
        )
        metrics.distribution(
            "events.size.data.post_save", job["event"].size, tags=metric_tags, unit="byte"
        )
        metrics.incr(
            "events.post_save.normalize.errors",
            amount=len(job["data"].get("errors") or ()),
            tags=metric_tags,
        )

        _track_outcome_accepted_many(jobs)

        self._data = job["event"].data.data

        # Check if the project is configured for auto upgrading and we need to upgrade
        # to the latest grouping config.
        update_grouping_config_if_needed(project)

        return job["event"]


def _should_run_secondary_grouping(project: Project) -> bool:
    result = False
    # These two values are basically always set
    secondary_grouping_config = project.get_option("sentry:secondary_grouping_config")
    secondary_grouping_expiry = project.get_option("sentry:secondary_grouping_expiry")
    if secondary_grouping_config and (secondary_grouping_expiry or 0) >= time.time():
        result = True
    return result


def _calculate_primary_hash(
    project: Project, job: Job, grouping_config: GroupingConfig
) -> CalculatedHashes:
    """
    Get the primary hash for the event.

    This is pulled out into a separate function mostly in order to make testing easier.
    """
    return _calculate_event_grouping(project, job["event"], grouping_config)


def _calculate_secondary_hash(
    project: Project, job: Job, secondary_grouping_config: GroupingConfig
) -> None | CalculatedHashes:
    """Calculate secondary hash for event using a fallback grouping config for a period of time.
    This happens when we upgrade all projects that have not opted-out to automatic upgrades plus
    when the customer changes the grouping config.
    This causes extra load in save_event processing.
    """
    secondary_hashes = None
    try:
        with sentry_sdk.start_span(
            op="event_manager",
            description="event_manager.save.secondary_calculate_event_grouping",
        ):
            # create a copy since `_calculate_event_grouping` modifies the event to add all sorts
            # of grouping info and we don't want the backup grouping data in there
            event_copy = copy.deepcopy(job["event"])
            secondary_hashes = _calculate_event_grouping(
                project, event_copy, secondary_grouping_config
            )
    except Exception:
        sentry_sdk.capture_exception()

    return secondary_hashes


def _calculate_background_grouping(
    project: Project, event: Event, config: GroupingConfig
) -> CalculatedHashes:
    metric_tags: MutableTags = {
        "grouping_config": config["id"],
        "platform": event.platform or "unknown",
        "sdk": normalized_sdk_tag_from_event(event),
    }
    with metrics.timer("event_manager.background_grouping", tags=metric_tags):
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
    Update every job in the list with required information and store it in the nodestore.

    A bunch of (probably) CPU bound stuff.
    """

    for job in jobs:
        job["project_id"] = int(job["project_id"])

        data = job["data"]

        # Pull the toplevel data we're interested in

        transaction_name = data.get("transaction")
        if transaction_name:
            transaction_name = force_str(transaction_name)
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
        # Stores the event in the nodestore
        job["event"] = event = _get_event_instance(job["data"], project_id=job["project_id"])
        # Overwrite the data key with the event's updated data
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
        job["groups"] = []


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
            integration_installation = integration.get_installation(
                organization_id=oi.organization_id
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
                    features.has(
                        "organizations:dynamic-sampling", projects[project_id].organization
                    )
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

    return environment


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


def _get_group_creation_kwargs(job: Union[Job, PerformanceJob]) -> dict[str, Any]:
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
        incrs.append((TSDBModel.project, job["project_id"]))
        event = job["event"]
        release = job["release"]
        environment = job["environment"]
        user = job["user"]

        for group_info in job["groups"]:
            incrs.append((TSDBModel.group, group_info.group.id))
            frequencies.append(
                (
                    TSDBModel.frequent_environments_by_group,
                    {group_info.group.id: {environment.id: 1}},
                )
            )

            if group_info.group_release:
                frequencies.append(
                    (
                        TSDBModel.frequent_releases_by_group,
                        {group_info.group.id: {group_info.group_release.id: 1}},
                    )
                )
            if user:
                records.append(
                    (TSDBModel.users_affected_by_group, group_info.group.id, (user.tag_value,))
                )

        if release:
            incrs.append((TSDBModel.release, release.id))

        if user:
            project_id = job["project_id"]
            records.append((TSDBModel.users_affected_by_project, project_id, (user.tag_value,)))

        if incrs:
            tsdb.backend.incr_multi(incrs, timestamp=event.datetime, environment_id=environment.id)

        if records:
            tsdb.backend.record_multi(
                records, timestamp=event.datetime, environment_id=environment.id
            )

        if frequencies:
            tsdb.backend.record_frequency_multi(frequencies, timestamp=event.datetime)


@metrics.wraps("save_event.nodestore_save_many")
def _nodestore_save_many(jobs: Sequence[Job], app_feature: str) -> None:
    inserted_time = datetime.utcnow().replace(tzinfo=timezone.utc).timestamp()
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

        if app_feature:
            event_size = 0
            event_metrics = job.get("event_metrics")
            if event_metrics:
                event_size = event_metrics.get("bytes.stored.event", 0)
            record(
                resource_id=settings.COGS_EVENT_STORE_LABEL,
                app_feature=app_feature,
                amount=event_size,
                usage_type=UsageUnit.BYTES,
            )
        job["event"].data["nodestore_insert"] = inserted_time
        job["event"].data.save(subkeys=subkeys)


@metrics.wraps("save_event.eventstream_insert_many")
def _eventstream_insert_many(jobs: Sequence[Job]) -> None:
    for job in jobs:
        if is_sample_event(job):
            logger.info(
                "_eventstream_insert_many: attempting to insert event into eventstream",
                extra={
                    "event.id": job["event"].event_id,
                    "project_id": job["event"].project_id,
                    "sample_event": True,
                },
            )

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

        if is_sample_event(job):
            logger.info(
                "_eventstream_insert_many: inserting into evenstream",
                extra={
                    "event.id": job["event"].event_id,
                    "project_id": job["event"].project_id,
                    "sample_event": True,
                },
            )
        eventstream.backend.insert(
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
    return eventstore.backend.create_event(
        project_id=project_id,
        event_id=data.get("event_id"),
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
        user_ident=user_data.get("id"),
        email=user_data.get("email"),
        username=user_data.get("username"),
        ip_address=ip_address,
        name=user_data.get("name"),
    )

    return euser


def get_event_type(data: Mapping[str, Any]) -> EventType:
    return eventtypes.get(data.get("type", "default"))()


EventMetadata = Dict[str, Any]


def materialize_metadata(
    data: Mapping[str, Any], event_type: EventType, event_metadata: dict[str, Any]
) -> EventMetadata:
    """Returns the materialized metadata to be merged with group or
    event data.  This currently produces the keys `type`, `culprit`,
    `metadata`, `title` and `location`.
    """

    # XXX(markus): Ideally this wouldn't take data or event_type, and instead
    # calculate culprit + type from event_metadata

    # Don't clobber existing metadata
    try:
        event_metadata.update(data.get("metadata", {}))
    except TypeError:
        # On a small handful of occasions, the line above has errored with `TypeError: 'NoneType'
        # object is not iterable`, even though it's clear from looking at the local variable values
        # in the event in Sentry that this shouldn't be possible.
        logger.exception(
            "Non-None being read as None",
            extra={
                "data is None": data is None,
                "event_metadata is None": event_metadata is None,
                "data.get": data.get,
                "event_metadata.update": event_metadata.update,
                "data.get('metadata', {})": data.get("metadata", {}),
            },
        )

    return {
        "type": event_type.key,
        "culprit": get_culprit(data),
        "metadata": event_metadata,
        "title": event_type.get_title(event_metadata),
        "location": event_type.get_location(event_metadata),
    }


def get_culprit(data: Mapping[str, Any]) -> str:
    """Helper to calculate the default culprit"""
    return str(
        force_str(data.get("culprit") or data.get("transaction") or generate_culprit(data) or "")
    )


def _save_aggregate(
    event: Event,
    hashes: CalculatedHashes,
    release: Optional[Release],
    metadata: dict[str, Any],
    received_timestamp: Union[int, float],
    migrate_off_hierarchical: Optional[bool] = False,
    **kwargs: Any,
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
        ) as metric_tags, transaction.atomic(
            router.db_for_write(GroupHash)
        ):
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

                if (
                    features.has("projects:first-event-severity-calculation", event.project)
                    and group.data.get("metadata", {}).get("severity") is None
                ):
                    logger.error(
                        "Group created without severity score",
                        extra={
                            "event_id": event.data["event_id"],
                            "group_id": group.id,
                        },
                    )

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
                    tags={
                        "platform": event.platform or "unknown",
                        "sdk": normalized_sdk_tag_from_event(event),
                    },
                )

                # This only applies to events with stacktraces
                frame_mix = event.get_event_metadata().get("in_app_frame_mix")
                if frame_mix:
                    metrics.incr(
                        "grouping.in_app_frame_mix",
                        sample_rate=1.0,
                        tags={
                            "platform": event.platform or "unknown",
                            "sdk": normalized_sdk_tag_from_event(event),
                            "frame_mix": frame_mix,
                        },
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
        group=group,
        event=event,
        incoming_group_values=kwargs,
        release=release,
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


def _create_group(project: Project, event: Event, **kwargs: Any) -> Group:
    try:
        short_id = project.next_short_id()
    except OperationalError:
        metrics.incr("next_short_id.timeout")
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

    group_data = kwargs.pop("data", {})

    # add sdk tag to metadata
    group_data.setdefault("metadata", {}).update(sdk_metadata_from_event(event))

    # add severity to metadata for alert filtering
    group_data["metadata"].update(_get_severity_metadata_for_group(event))

    return Group.objects.create(
        project=project,
        short_id=short_id,
        first_release_id=first_release_id,
        data=group_data,
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

    group.active_at = date
    group.status = GroupStatus.UNRESOLVED
    group.substatus = GroupSubStatus.REGRESSED
    # groups may have been updated already from a separate event that groups to the same group
    # only fire these signals the first time the row was actually updated
    if is_regression:
        issue_unresolved.send_robust(
            project=group.project,
            user=None,
            group=group,
            transition_type="automatic",
            sender="handle_regression",
        )
        post_save.send(
            sender=Group,
            instance=group,
            created=False,
            update_fields=["last_seen", "active_at", "status", "substatus"],
        )

    follows_semver = False
    resolved_in_activity = None
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
                resolved_in_activity = Activity.objects.filter(
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
                    if resolved_in_activity.data["version"] == "":
                        resolved_in_activity.update(
                            data={**resolved_in_activity.data, "version": release.version}
                        )
                except KeyError:
                    # Safeguard in case there is no "version" key. However, should not happen
                    resolved_in_activity.update(data={"version": release.version})

            # Record how we compared the two releases
            follows_semver = follows_semver_versioning_scheme(
                project_id=group.project.id,
                org_id=group.organization.id,
                release_version=release.version,
            )

    if is_regression:
        activity_data: dict[str, str | bool] = {
            "event_id": event.event_id,
            "version": release.version if release else "",
        }
        if resolved_in_activity and release:
            activity_data.update(
                {
                    "follows_semver": follows_semver,
                    "resolved_in_version": resolved_in_activity.data.get(
                        "version", release.version
                    ),
                }
            )

        Activity.objects.create_group_activity(
            group,
            ActivityType.SET_REGRESSION,
            data=activity_data,
        )
        record_group_history(group, GroupHistoryStatus.REGRESSED, actor=None, release=release)

        kick_off_status_syncs.apply_async(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )

    return is_regression


def _process_existing_aggregate(
    group: Group, event: Event, incoming_group_values: Mapping[str, Any], release: Optional[Release]
) -> bool:
    last_seen = max(event.datetime, group.last_seen)
    updated_group_values: dict[str, Any] = {"last_seen": last_seen}
    # Unclear why this is necessary, given that it's also in `updated_group_values`, but removing
    # it causes unrelated tests to fail. Hard to say if that's the tests or the removal, though.
    group.last_seen = updated_group_values["last_seen"]

    if (
        event.search_message
        and event.search_message != group.message
        and event.get_event_type() != TransactionEvent.key
    ):
        updated_group_values["message"] = event.search_message
    if group.level != incoming_group_values["level"]:
        updated_group_values["level"] = incoming_group_values["level"]
    if group.culprit != incoming_group_values["culprit"]:
        updated_group_values["culprit"] = incoming_group_values["culprit"]

    # If the new event has a timestamp earlier than our current `fist_seen` value (which can happen,
    # for example because of misaligned internal clocks on two different host machines or because of
    # race conditions) then we want to use the current event's time
    if group.first_seen > event.datetime:
        updated_group_values["first_seen"] = event.datetime

    is_regression = _handle_regression(group, event, release)

    # Merge new data with existing data
    incoming_data = incoming_group_values["data"]
    incoming_metadata = incoming_group_values["data"].get("metadata", {})

    existing_data = group.data
    # Grab a reference to this before it gets clobbered when we update `existing_data`
    existing_metadata = group.data.get("metadata", {})

    existing_data.update(incoming_data)
    existing_metadata.update(incoming_metadata)

    updated_group_values["data"] = existing_data
    updated_group_values["data"]["metadata"] = existing_metadata

    update_kwargs = {"times_seen": 1}

    buffer_incr(Group, update_kwargs, {"id": group.id}, updated_group_values)

    return bool(is_regression)


severity_connection_pool = connection_from_url(
    settings.SEVERITY_DETECTION_URL,
    retries=Retry(
        total=SEVERITY_DETECTION_RETRIES,  # Defaults to 1
        status_forcelist=[
            408,  # Request timeout
            429,  # Too many requests
            502,  # Bad gateway
            503,  # Service unavailable
            504,  # Gateway timeout
        ],
    ),
    timeout=settings.SEVERITY_DETECTION_TIMEOUT,  # Defaults to 300 milliseconds
)


def _get_severity_metadata_for_group(event: Event) -> Mapping[str, Any]:
    """
    Returns severity metadata for an event if the feature flag is enabled.
    Returns {} on feature flag not enabled or exception.
    """
    if features.has("projects:first-event-severity-calculation", event.project):
        try:
            severity, reason = _get_severity_score(event)

            return {
                "severity": severity,
                "severity_reason": reason,
            }
        except Exception as e:
            logger.warning("Failed to calculate severity score for group", repr(e))

            return {}

    return {}


def _get_severity_score(event: Event) -> Tuple[float, str]:
    # Short circuit the severity value if we know the event is fatal or info/debug
    level = str(event.data.get("level", "error"))
    if LOG_LEVELS_MAP[level] == logging.FATAL:
        return 1.0, "log_level_fatal"
    if LOG_LEVELS_MAP[level] <= logging.INFO:
        return 0.0, "log_level_info"

    op = "event_manager._get_severity_score"
    logger_data = {"event_id": event.data["event_id"], "op": op}
    severity = 1.0
    reason = None

    event_type = get_event_type(event.data)
    metadata = event_type.get_metadata(event.data)

    exception_type = metadata.get("type")
    exception_value = metadata.get("value")

    if exception_type:
        title = exception_type
        if exception_value:
            title += f": {exception_value}"

        # We truncate the title to 128 characters as any more than that is unlikely to be helpful
        # and would slow down the model.
        title = trim(title, 128)
    else:
        # Fall back to using just the title for events without an exception.
        title = event.title

    # If the event hasn't yet been given a helpful title, attempt to calculate one
    if title in NON_TITLE_EVENT_TITLES:
        title = event_type.get_title(metadata)

    # If there's still nothing helpful to be had, bail
    if title in NON_TITLE_EVENT_TITLES:
        logger_data.update(
            {"event_type": event_type.key, "event_title": event.title, "computed_title": title}
        )
        logger.warning(
            "Unable to get severity score because of unusable `message` value '%s'",
            title,
            extra=logger_data,
        )
        return 0.0, "bad_title"

    payload = {
        "message": title,
        "has_stacktrace": int(has_stacktrace(event.data)),
        "handled": is_handled(event.data),
    }

    if options.get("processing.severity-backlog-test.timeout"):
        payload["trigger_timeout"] = True
    if options.get("processing.severity-backlog-test.error"):
        payload["trigger_error"] = True

    logger_data["payload"] = payload

    with metrics.timer(op):
        with sentry_sdk.start_span(op=op):
            try:
                response = severity_connection_pool.urlopen(
                    "POST",
                    "/v0/issues/severity-score",
                    body=json.dumps(payload),
                    headers={"content-type": "application/json;charset=utf-8"},
                )
                severity = json.loads(response.data).get("severity")
                reason = "ml"
            except MaxRetryError as e:
                logger.warning(
                    "Unable to get severity score from microservice after %s retr%s. Got MaxRetryError caused by: %s.",
                    SEVERITY_DETECTION_RETRIES,
                    "ies" if SEVERITY_DETECTION_RETRIES > 1 else "y",
                    repr(e.reason),
                    extra=logger_data,
                )
                reason = "microservice_max_retry"
            except Exception as e:
                logger.warning(
                    "Unable to get severity score from microservice. Got: %s.",
                    repr(e),
                    extra=logger_data,
                )
                reason = "microservice_error"
            else:
                logger.info(
                    "Got severity score of %s for event %s",
                    severity,
                    event.data["event_id"],
                    extra=logger_data,
                )

    return severity, reason


Attachment = CachedAttachment


def discard_event(job: Job, attachments: Sequence[Attachment]) -> None:
    """
    Refunds consumed quotas for an event and its attachments.

    For the event and each dropped attachment, an outcome
    FILTERED(discarded-hash) is emitted.

    :param job:         The job context container.
    :param attachments: The full list of attachments to filter.
    """

    project = job["event"].project

    quotas.backend.refund(
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
        quotas.backend.refund(
            project,
            key=job["project_key"],
            timestamp=job["start_time"],
            category=DataCategory.ATTACHMENT,
            quantity=attachment_quantity,
        )

    metrics.incr(
        "events.discarded",
        skip_internal=True,
        tags={
            "platform": job["platform"],
            "sdk": normalized_sdk_tag_from_event(job["event"]),
        },
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
        quotas.backend.refund(
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
        timestamp = datetime.utcnow().replace(tzinfo=timezone.utc)

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

    content_type = normalize_content_type(attachment.content_type, attachment.name)

    file = File.objects.create(
        name=attachment.name,
        type=attachment.type,
        headers={"Content-Type": content_type},
    )
    file.putfile(BytesIO(data), blob_size=settings.SENTRY_ATTACHMENT_BLOB_SIZE)

    size = file.size
    sha1 = file.checksum
    file_id = file.id

    EventAttachment.objects.create(
        # lookup:
        project_id=project.id,
        group_id=group_id,
        event_id=event_id,
        # metadata:
        type=attachment.type,
        name=attachment.name,
        content_type=content_type,
        size=size,
        sha1=sha1,
        # storage:
        file_id=file_id,
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


def normalize_content_type(content_type: str | None, name: str) -> str:
    if content_type:
        return content_type.split(";")[0].strip()
    return mimetypes.guess_type(name)[0] or "application/octet-stream"


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


def _calculate_event_grouping(
    project: Project, event: Event, grouping_config: GroupingConfig
) -> CalculatedHashes:
    """
    Main entrypoint for modifying/enhancing and grouping an event, writes
    hashes back into event payload.
    """
    metric_tags: MutableTags = {
        "grouping_config": grouping_config["id"],
        "platform": event.platform or "unknown",
        "sdk": normalized_sdk_tag_from_event(event),
    }

    with metrics.timer("save_event.calculate_event_grouping", tags=metric_tags):
        with metrics.timer("event_manager.normalize_stacktraces_for_grouping", tags=metric_tags):
            with sentry_sdk.start_span(op="event_manager.normalize_stacktraces_for_grouping"):
                event.normalize_stacktraces_for_grouping(load_grouping_config(grouping_config))

        # Detect & set synthetic marker if necessary
        detect_synthetic_exception(event.data, grouping_config)

        with metrics.timer("event_manager.apply_server_fingerprinting", tags=metric_tags):
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
            # event. If that config has since been deleted (because it was an
            # experimental grouping config) we fall back to the default.
            try:
                hashes = event.get_hashes(grouping_config)
            except GroupingConfigNotFound:
                event.data["grouping_config"] = get_grouping_config_dict_for_project(project)
                hashes = event.get_hashes()

        hashes.write_to_event(event.data)
        return hashes


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

            metrics.distribution("save_event.transaction.span_count", len(groupings.results))
            unique_default_hashes = set(groupings.results.values())
            metrics.incr(
                "save_event.transaction.span_group_count.default",
                amount=len(unique_default_hashes),
                tags={
                    "platform": job["platform"] or "unknown",
                    "sdk": normalized_sdk_tag_from_event(event),
                },
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
    project: Project,
    event: Event,
    new_grouphash: str,
    **group_kwargs: Any,
) -> Tuple[Group, bool]:
    group = None
    with transaction.atomic(router.db_for_write(GroupHash)):
        group_hash, created = GroupHash.objects.get_or_create(project=project, hash=new_grouphash)
        if created:
            group = _create_group(project, event, **group_kwargs)
            group_hash.update(group=group)

            if (
                features.has("projects:first-event-severity-calculation", event.project)
                and group.data.get("metadata", {}).get("severity") is None
            ):
                logger.error(
                    "Group created without severity score",
                    extra={
                        "event_id": event.data["event_id"],
                        "group_id": group.id,
                    },
                )

    if group is None:
        # If we failed to create the group it means another worker beat us to
        # it. Since a GroupHash can only be created in a transaction with the
        # Group, we can guarantee that the Group will exist at this point and
        # fetch it via GroupHash
        group = Group.objects.get(grouphash__project=project, grouphash__hash=new_grouphash)
    return group, created


@metrics.wraps("save_event.send_occurrence_to_platform")
def _send_occurrence_to_platform(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        event = job["event"]
        project = event.project
        event_id = event.event_id

        performance_problems = job["performance_problems"]
        if features.has("organizations:issue-platform-extra-logging", project.organization):
            if performance_problems and len(performance_problems) > 0:
                logger.warning(
                    "Detected %s performance problems",
                    len(performance_problems),
                    extra={
                        "performance_problems": performance_problems,
                        "project_id": project.id,
                        "event_id": event_id,
                    },
                )
            else:
                logger.warning(
                    "No performance problems detected",
                    extra={
                        "project_id": project.id,
                        "event_id": event_id,
                    },
                )

        for problem in performance_problems:
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

            produce_occurrence_to_kafka(payload_type=PayloadType.OCCURRENCE, occurrence=occurrence)


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

    _get_or_create_release_many(jobs, projects)
    _get_event_user_many(jobs, projects)
    _derive_plugin_tags_many(jobs, projects)
    _derive_interface_tags_many(jobs)
    _calculate_span_grouping(jobs, projects)
    _materialize_metadata_many(jobs)
    _get_or_create_environment_many(jobs, projects)
    _get_or_create_release_associated_models(jobs, projects)
    _tsdb_record_all_metrics(jobs)
    _materialize_event_metrics(jobs)
    _nodestore_save_many(jobs=jobs, app_feature="transactions")
    _eventstream_insert_many(jobs)
    _track_outcome_accepted_many(jobs)
    _detect_performance_problems(jobs, projects)
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

    _get_or_create_release_many(jobs, projects)
    _get_event_user_many(jobs, projects)
    _derive_plugin_tags_many(jobs, projects)
    _derive_interface_tags_many(jobs)
    _materialize_metadata_many(jobs)
    _get_or_create_environment_many(jobs, projects)
    _materialize_event_metrics(jobs)
    _nodestore_save_many(jobs=jobs, app_feature="issue_platform")

    return jobs
