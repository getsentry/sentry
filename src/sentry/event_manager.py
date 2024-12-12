from __future__ import annotations

import ipaddress
import logging
import uuid
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Literal, TypedDict, overload

import orjson
import sentry_sdk
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import IntegrityError, OperationalError, connection, router, transaction
from django.db.models import Max
from django.db.models.signals import post_save
from django.utils.encoding import force_str
from urllib3.exceptions import MaxRetryError, TimeoutError
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
from sentry.constants import (
    DEFAULT_STORE_NORMALIZER_ARGS,
    INSIGHT_MODULE_FILTERS,
    LOG_LEVELS_MAP,
    MAX_TAG_VALUE_LENGTH,
    PLACEHOLDER_EVENT_TITLES,
    DataCategory,
    InsightModules,
)
from sentry.culprit import generate_culprit
from sentry.dynamic_sampling import LatestReleaseBias, LatestReleaseParams
from sentry.eventstore.processing import event_processing_store
from sentry.eventstream.base import GroupState
from sentry.eventtypes import EventType
from sentry.eventtypes.transaction import TransactionEvent
from sentry.exceptions import HashDiscarded
from sentry.features.rollout import in_rollout_group
from sentry.grouping.api import (
    NULL_GROUPHASH_INFO,
    GroupHashInfo,
    GroupingConfig,
    get_grouping_config_dict_for_project,
)
from sentry.grouping.ingest.config import is_in_transition, update_grouping_config_if_needed
from sentry.grouping.ingest.hashing import (
    find_grouphash_with_group,
    get_or_create_grouphashes,
    maybe_run_background_grouping,
    maybe_run_secondary_grouping,
    run_primary_grouping,
)
from sentry.grouping.ingest.metrics import record_hash_calculation_metrics, record_new_group_metrics
from sentry.grouping.ingest.seer import maybe_check_seer_for_matching_grouphash
from sentry.grouping.ingest.utils import (
    add_group_id_to_grouphashes,
    check_for_group_creation_load_shed,
    is_non_error_type_group,
)
from sentry.grouping.variants import BaseVariant
from sentry.ingest.inbound_filters import FilterStatKeys
from sentry.ingest.transaction_clusterer.datasource.redis import (
    record_transaction_name as record_transaction_name_for_clustering,
)
from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs
from sentry.issues.grouptype import ErrorGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.killswitches import killswitch_matches_context
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL, convert_crashreport_count
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.event import EventDict
from sentry.models.eventattachment import CRASH_REPORT_TYPES, EventAttachment, get_crashreport_key
from sentry.models.group import Group, GroupStatus
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouphash import GroupHash
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.grouplink import GroupLink
from sentry.models.grouprelease import GroupRelease
from sentry.models.groupresolution import GroupResolution
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.models.pullrequest import PullRequest
from sentry.models.release import Release, follows_semver_versioning_scheme
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.net.http import connection_from_url
from sentry.plugins.base import plugins
from sentry.quotas.base import index_data_category
from sentry.receivers.features import record_event_processed
from sentry.receivers.onboarding import record_release_received, record_user_context_received
from sentry.reprocessing2 import is_reprocessed_event
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.signals import (
    first_event_received,
    first_event_with_minified_stack_trace_received,
    first_insight_span_received,
    first_transaction_received,
    issue_unresolved,
)
from sentry.tasks.process_buffer import buffer_incr
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.tsdb.base import TSDBModel
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel
from sentry.usage_accountant import record
from sentry.utils import metrics
from sentry.utils.cache import cache_key_for_event
from sentry.utils.circuit_breaker import (
    ERROR_COUNT_CACHE_KEY,
    CircuitBreakerPassthrough,
    circuit_breaker_activated,
)
from sentry.utils.dates import to_datetime
from sentry.utils.event import has_event_minified_stack_trace, has_stacktrace, is_handled
from sentry.utils.eventuser import EventUser
from sentry.utils.metrics import MutableTags
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.performance_issues.performance_detection import detect_performance_problems
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.utils.safe import get_path, safe_execute, setdefault_path, trim
from sentry.utils.sdk import set_measurement
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

from .utils.event_tracker import TransactionStageStatus, track_sampled_event

if TYPE_CHECKING:
    from sentry.eventstore.models import BaseEvent, Event

logger = logging.getLogger("sentry.events")

SECURITY_REPORT_INTERFACES = ("csp", "hpkp", "expectct", "expectstaple", "nel")

# Timeout for cached group crash report counts
CRASH_REPORT_TIMEOUT = 24 * 3600  # one day


HIGH_SEVERITY_THRESHOLD = 0.1

SEER_ERROR_COUNT_KEY = ERROR_COUNT_CACHE_KEY("sentry.seer.severity-failures")


@dataclass
class GroupInfo:
    group: Group
    is_new: bool
    is_regression: bool
    group_release: GroupRelease | None = None
    is_new_group_environment: bool = False


def pop_tag(data: dict[str, Any], key: str) -> None:
    if "tags" not in data:
        return

    data["tags"] = [kv for kv in data["tags"] if kv is None or kv[0] != key]


def set_tag(data: dict[str, Any], key: str, value: Any) -> None:
    pop_tag(data, key)
    if value is not None:
        data.setdefault("tags", []).append((key, trim(value, MAX_TAG_VALUE_LENGTH)))


def get_tag(data: dict[str, Any], key: str) -> Any | None:
    for k, v in get_path(data, "tags", filter=True) or ():
        if k == key:
            return v
    return None


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
                "name_normalized": normalized_sdk_tag_from_event(event.data),
            }
        }
    except Exception:
        logger.warning("failed to set normalized SDK name", exc_info=True)
        return {}


def plugin_is_regression(group: Group, event: BaseEvent) -> bool:
    project = event.project
    for plugin in plugins.for_project(project):
        result = safe_execute(plugin.is_regression, group, event, version=1)
        if result is not None:
            return bool(result)
    return True


def get_project_insight_flag(project: Project, module: InsightModules):
    if module == InsightModules.HTTP:
        return project.flags.has_insights_http
    elif module == InsightModules.DB:
        return project.flags.has_insights_db
    elif module == InsightModules.ASSETS:
        return project.flags.has_insights_assets
    elif module == InsightModules.APP_START:
        return project.flags.has_insights_app_start
    elif module == InsightModules.SCREEN_LOAD:
        return project.flags.has_insights_screen_load
    elif module == InsightModules.VITAL:
        return project.flags.has_insights_vitals
    elif module == InsightModules.CACHE:
        return project.flags.has_insights_caches
    elif module == InsightModules.QUEUE:
        return project.flags.has_insights_queues
    elif module == InsightModules.LLM_MONITORING:
        return project.flags.has_insights_llm_monitoring


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


@overload
def get_max_crashreports(model: Project | Organization) -> int: ...


@overload
def get_max_crashreports(
    model: Project | Organization, *, allow_none: Literal[True]
) -> int | None: ...


def get_max_crashreports(model: Project | Organization, *, allow_none: bool = False) -> int | None:
    value = model.get_option("sentry:store_crash_reports")
    return convert_crashreport_count(value, allow_none=allow_none)


def crashreports_exceeded(current_count: int, max_count: int) -> bool:
    if max_count == STORE_CRASH_REPORTS_ALL:
        return False
    return current_count >= max_count


def get_stored_crashreports(cache_key: str | None, event: Event, max_crashreports: int) -> int:
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


ProjectsMapping = Mapping[int, Project]

Job = MutableMapping[str, Any]


class EventManager:
    """
    Handles normalization in both the store endpoint and the save task. The
    intention is to swap this class out with a reimplementation in Rust.
    """

    def __init__(
        self,
        data: MutableMapping[str, Any],
        version: str = "5",
        project: Project | None = None,
        grouping_config: GroupingConfig | None = None,
        client_ip: str | None = None,
        user_agent: str | None = None,
        auth: Any | None = None,
        key: Any | None = None,
        content_encoding: str | None = None,
        is_renormalize: bool = False,
        remove_other: bool | None = None,
        project_config: Any | None = None,
        sent_at: datetime | None = None,
    ):
        self._data: MutableMapping[str, Any] = data
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

    def normalize(self, project_id: int | None = None) -> None:
        with metrics.timer("events.store.normalize.duration"):
            self._normalize_impl(project_id=project_id)

    def _normalize_impl(self, project_id: int | None = None) -> None:
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
            json_dumps=orjson.dumps,
            **DEFAULT_STORE_NORMALIZER_ARGS,
        )

        pre_normalize_type = self._data.get("type")
        self._data = rust_normalizer.normalize_event(dict(self._data), json_loads=orjson.loads)
        # XXX: This is a hack to make generic events work (for now?). I'm not sure whether we should
        # include this in the rust normalizer, since we don't want people sending us these via the
        # sdk.
        if pre_normalize_type in ("generic", "feedback"):
            self._data["type"] = pre_normalize_type

    def get_data(self) -> MutableMapping[str, Any]:
        return self._data

    @sentry_sdk.tracing.trace
    def save(
        self,
        project_id: int | None,
        raw: bool = False,
        assume_normalized: bool = False,
        start_time: float | None = None,
        cache_key: str | None = None,
        skip_send_first_transaction: bool = False,
        has_attachments: bool = False,
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

        project = Project.objects.get_from_cache(id=project_id)
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
        _pull_out_data([job], projects)

        event_type = self._data.get("type")
        if event_type == "transaction":
            job["data"]["project"] = project.id
            jobs = save_transaction_events([job], projects)

            if not project.flags.has_transactions and not skip_send_first_transaction:
                first_transaction_received.send_robust(
                    project=project, event=jobs[0]["event"], sender=Project
                )

            for module, is_module in INSIGHT_MODULE_FILTERS.items():
                if not get_project_insight_flag(project, module) and is_module(job["data"]):
                    first_insight_span_received.send_robust(
                        project=project, module=module, sender=Project
                    )
            return jobs[0]["event"]
        elif event_type == "generic":
            job["data"]["project"] = project.id
            jobs = save_generic_events([job], projects)

            return jobs[0]["event"]
        else:
            project = job["event"].project
            job["in_grouping_transition"] = is_in_transition(project)
            metric_tags = {
                "platform": job["event"].platform or "unknown",
                "sdk": normalized_sdk_tag_from_event(job["event"].data),
                "in_transition": job["in_grouping_transition"],
            }
            # This metric allows differentiating from all calls to the `event_manager.save` metric
            # and adds support for differentiating based on platforms
            with metrics.timer("event_manager.save_error_events", tags=metric_tags):
                return self.save_error_events(
                    project,
                    job,
                    projects,
                    metric_tags,
                    raw,
                    cache_key,
                    has_attachments=has_attachments,
                )

    @sentry_sdk.tracing.trace
    def save_error_events(
        self,
        project: Project,
        job: Job,
        projects: ProjectsMapping,
        metric_tags: MutableTags,
        raw: bool = False,
        cache_key: str | None = None,
        has_attachments: bool = False,
    ) -> Event:
        jobs = [job]

        is_reprocessed = is_reprocessed_event(job["data"])

        _get_or_create_release_many(jobs, projects)
        _get_event_user_many(jobs, projects)

        job["project_key"] = None
        if job["key_id"] is not None:
            try:
                job["project_key"] = ProjectKey.objects.get_from_cache(id=job["key_id"])
            except ProjectKey.DoesNotExist:
                pass

        _derive_plugin_tags_many(jobs, projects)
        _derive_interface_tags_many(jobs)

        # Load attachments first, but persist them at the very last after
        # posting to eventstream to make sure all counters and eventstream are
        # incremented for sure. Also wait for grouping to remove attachments
        # based on the group counter.
        if has_attachments:
            attachments = get_attachments(cache_key, job)
        else:
            attachments = []

        try:
            group_info = assign_event_to_group(event=job["event"], job=job, metric_tags=metric_tags)

        except HashDiscarded:
            discard_event(job, attachments)
            raise

        if not group_info:
            return job["event"]

        # store a reference to the group id to guarantee validation of isolation
        # XXX(markus): No clue what this does
        job["event"].data.bind_ref(job["event"])

        _get_or_create_environment_many(jobs, projects)
        _get_or_create_group_environment_many(jobs)
        _get_or_create_release_associated_models(jobs, projects)
        _increment_release_associated_counts_many(jobs, projects)
        _get_or_create_group_release_many(jobs)
        _tsdb_record_all_metrics(jobs)

        if attachments:
            attachments = filter_attachments_for_group(attachments, job)

        # XXX: DO NOT MUTATE THE EVENT PAYLOAD AFTER THIS POINT
        _materialize_event_metrics(jobs)

        for attachment in attachments:
            key = f"bytes.stored.{attachment.type}"
            old_bytes = job["event_metrics"].get(key) or 0
            job["event_metrics"][key] = old_bytes + attachment.size

        _nodestore_save_many(jobs=jobs, app_feature="errors")

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
            )

        _eventstream_insert_many(jobs)

        # Do this last to ensure signals get emitted even if connection to the
        # file store breaks temporarily.
        #
        # We do not need this for reprocessed events as for those we update the
        # group_id on existing models in post_process_group, which already does
        # this because of indiv. attachments.
        if not is_reprocessed and attachments:
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

        return job["event"]


@sentry_sdk.tracing.trace
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


@sentry_sdk.tracing.trace
def _get_or_create_release_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    jobs_with_releases: dict[tuple[int, str], list[Job]] = {}
    release_date_added: dict[tuple[int, str], datetime] = {}

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


def _get_environment_from_transaction(data: EventDict) -> str | None:
    environment = data.get("environment", None)
    # We handle the case in which the users sets the empty string as environment, for us that
    # is equal to having no environment at all.
    if environment == "":
        environment = None

    return environment


@sentry_sdk.tracing.trace
def _get_event_user_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        data = job["data"]
        user = _get_event_user(projects[job["project_id"]], data)

        if user:
            pop_tag(data, "user")
            set_tag(data, "sentry:user", user.tag_value)

        job["user"] = user


@sentry_sdk.tracing.trace
def _derive_plugin_tags_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    # XXX: We ought to inline or remove this one for sure
    plugins_for_projects = {p.id: plugins.for_project(p, version=None) for p in projects.values()}

    for job in jobs:
        for plugin in plugins_for_projects[job["project_id"]]:
            added_tags = safe_execute(plugin.get_tags, job["event"])
            if added_tags:
                data = job["data"]
                # plugins should not override user provided tags
                for key, value in added_tags:
                    if get_tag(data, key) is None:
                        set_tag(data, key, value)


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

        data.update(materialize_metadata(data, event_type, event_metadata))
        job["culprit"] = data["culprit"]


def _get_group_processing_kwargs(job: Job) -> dict[str, Any]:
    """
    Pull together all the metadata used when creating a group or updating a group's metadata based
    on a new event.

    Note: Must be called *after* grouping has run, because the grouping process can affect the title
    (by setting `main_exception_id` or by setting the title directly using a custom fingerprint
    rule).
    """
    _materialize_metadata_many([job])

    event_data = job["event"].data
    event_metadata = job["event_metadata"]

    group_metadata = materialize_metadata(
        event_data,
        # In principle the group gets the same metadata as the event, so common
        # attributes can be defined in eventtypes.
        get_event_type(event_data),
        event_metadata,
    )
    group_metadata["last_received"] = job["received_timestamp"]

    kwargs = {
        "data": group_metadata,
        "platform": job["platform"],
        "message": job["event"].search_message,
        "logger": job["logger_name"],
        "level": LOG_LEVELS_MAP.get(job["level"]),
        "last_seen": job["event"].datetime,
        "first_seen": job["event"].datetime,
        "active_at": job["event"].datetime,
        "culprit": job["culprit"],
    }

    if job["release"]:
        kwargs["first_release"] = job["release"]

    return kwargs


@sentry_sdk.tracing.trace
def _get_or_create_environment_many(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        job["environment"] = Environment.get_or_create(
            project=projects[job["project_id"]], name=job["environment"]
        )


@sentry_sdk.tracing.trace
def _get_or_create_group_environment_many(jobs: Sequence[Job]) -> None:
    for job in jobs:
        _get_or_create_group_environment(job["environment"], job["release"], job["groups"])


def _get_or_create_group_environment(
    environment: Environment, release: Release | None, groups: Sequence[GroupInfo]
) -> None:
    for group_info in groups:
        group_info.is_new_group_environment = GroupEnvironment.get_or_create(
            group_id=group_info.group.id,
            environment_id=environment.id,
            defaults={"first_release": release or None},
        )[1]


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
    release: Release | None,
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


def _get_or_create_group_release_many(jobs: Sequence[Job]) -> None:
    for job in jobs:
        _get_or_create_group_release(
            job["environment"], job["release"], job["event"], job["groups"]
        )


def _get_or_create_group_release(
    environment: Environment,
    release: Release | None,
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


def _nodestore_save_many(jobs: Sequence[Job], app_feature: str) -> None:
    inserted_time = datetime.now(timezone.utc).timestamp()
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
            group_states: list[GroupState] | None = None
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

        # Skip running grouping for "transaction" events:
        primary_hash = (
            None if job["data"].get("type") == "transaction" else job["event"].get_primary_hash()
        )

        eventstream.backend.insert(
            event=job["event"],
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            primary_hash=primary_hash,
            received_timestamp=job["received_timestamp"],
            # We are choosing to skip consuming the event back
            # in the eventstream if it's flagged as raw.
            # This means that we want to publish the event
            # through the event stream, but we don't care
            # about post processing and handling the commit.
            skip_consume=job.get("raw", False),
            group_states=group_states,
        )


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


def _get_event_instance(data: MutableMapping[str, Any], project_id: int) -> Event:
    return eventstore.backend.create_event(
        project_id=project_id,
        event_id=data.get("event_id"),
        group_id=None,
        data=EventDict(data, skip_renormalization=True),
    )


def _get_event_user(project: Project, data: Mapping[str, Any]) -> EventUser | None:
    with metrics.timer("event_manager.get_event_user") as metrics_tags:
        return _get_event_user_impl(project, data, metrics_tags)


def _get_event_user_impl(
    project: Project, data: Mapping[str, Any], metrics_tags: MutableTags
) -> EventUser | None:
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


EventMetadata = dict[str, Any]


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


@sentry_sdk.tracing.trace
def assign_event_to_group(
    event: Event,
    job: Job,
    metric_tags: MutableTags,
) -> GroupInfo | None:
    project = event.project
    secondary = NULL_GROUPHASH_INFO

    # Try looking for an existing group using the current grouping config
    primary = get_hashes_and_grouphashes(job, run_primary_grouping, metric_tags)

    # If we've found one, great. No need to do any more calculations
    if primary.existing_grouphash:
        group_info = handle_existing_grouphash(job, primary.existing_grouphash, primary.grouphashes)
        result = "found_primary"
    # If we haven't, try again using the secondary config. (If there is no secondary config, or
    # we're out of the transition period, we'll get back the empty `NULL_GROUPHASH_INFO`.)
    else:
        secondary = get_hashes_and_grouphashes(job, maybe_run_secondary_grouping, metric_tags)
        all_grouphashes = primary.grouphashes + secondary.grouphashes

        if secondary.existing_grouphash:
            group_info = handle_existing_grouphash(
                job, secondary.existing_grouphash, all_grouphashes
            )
            result = "found_secondary"
        # If we still haven't found a group, ask Seer for a match (if enabled for the project)
        else:
            seer_matched_grouphash = maybe_check_seer_for_matching_grouphash(
                event, primary.variants, all_grouphashes
            )

            if seer_matched_grouphash:
                group_info = handle_existing_grouphash(job, seer_matched_grouphash, all_grouphashes)
            # If we *still* haven't found a group into which to put the event, create a new group
            else:
                group_info = create_group_with_grouphashes(job, all_grouphashes)
            result = "no_match"

    # From here on out, we're just doing housekeeping

    # Background grouping is a way for us to get performance metrics for a new
    # config without having it actually affect on how events are grouped. It runs
    # either before or after the main grouping logic, depending on the option value.
    maybe_run_background_grouping(project, job)

    record_hash_calculation_metrics(
        project, primary.config, primary.hashes, secondary.config, secondary.hashes, result
    )

    # Now that we've used the current and possibly secondary grouping config(s) to calculate the
    # hashes, we're free to perform a config update if needed. Future events will use the new
    # config, but will also be grandfathered into the current config for a week, so as not to
    # erroneously create new groups.
    update_grouping_config_if_needed(project, "ingest")

    # The only way there won't be group info is we matched to a performance, cron, replay, or
    # other-non-error-type group because of a hash collision - exceedingly unlikely, and not
    # something we've ever observed, but theoretically possible.
    if group_info:
        event.group = group_info.group
    job["groups"] = [group_info]

    return group_info


def get_hashes_and_grouphashes(
    job: Job,
    hash_calculation_function: Callable[
        [Project, Job, MutableTags],
        tuple[GroupingConfig, list[str], dict[str, BaseVariant]],
    ],
    metric_tags: MutableTags,
) -> GroupHashInfo:
    """
    Calculate hashes for the job's event, create corresponding `GroupHash` entries if they don't yet
    exist, and determine if there's an existing group associated with any of the hashes.

    If the callback determines that it doesn't need to run its calculations (as may be the case with
    secondary grouping), this will return an empty list of grouphashes (so iteration won't break)
    and Nones for everything else.
    """
    event = job["event"]
    project = event.project

    # These will come back as Nones if the calculation decides it doesn't need to run
    grouping_config, hashes, variants = hash_calculation_function(project, job, metric_tags)

    if hashes:
        grouphashes = get_or_create_grouphashes(
            event, project, variants, hashes, grouping_config["id"]
        )

        existing_grouphash = find_grouphash_with_group(grouphashes)

        return GroupHashInfo(grouping_config, variants, hashes, grouphashes, existing_grouphash)
    else:
        return NULL_GROUPHASH_INFO


def handle_existing_grouphash(
    job: Job,
    existing_grouphash: GroupHash,
    all_grouphashes: list[GroupHash],
) -> GroupInfo | None:
    """
    Handle the case where an incoming event matches an existing group, by assigning the event to the
    group, updating the group metadata with data from the event, and linking any newly-calculated
    grouphashes to the group.
    """

    # There is a race condition here where two processes could "steal"
    # hashes from each other. In practice this should not be user-visible
    # as group creation is synchronized, meaning the only way hashes could
    # jump between groups is if there were two processes that:
    #
    # 1) have BOTH found an existing group
    #    (otherwise at least one of them would be in the group creation
    #    codepath which has transaction isolation/acquires row locks)
    # 2) AND are looking at the same set, or an overlapping set of hashes
    #    (otherwise they would not operate on the same rows)
    # 3) yet somehow also retrieve different groups here
    #    (otherwise the update would not change anything)
    #
    # We think this is a very unlikely situation. A previous version of
    # this function had races around group creation which made this race
    # more user visible. For more context, see 84c6f75a and d0e22787, as
    # well as GH-5085.
    group = Group.objects.get(id=existing_grouphash.group_id)

    # As far as we know this has never happened, but in theory at least, the error event hashing
    # algorithm and other event hashing algorithms could come up with the same hash value in the
    # same project and our hash could have matched to a non-error group. Just to be safe, we make
    # sure that's not the case before proceeding.
    if is_non_error_type_group(group):
        return None

    # There may still be hashes that we did not use to find an existing
    # group. A classic example is when grouping makes changes to the
    # app-hash (changes to in_app logic), but the system hash stays
    # stable and is used to find an existing group. Associate any new
    # hashes with the group such that event saving continues to be
    # resilient against grouping algorithm changes.
    add_group_id_to_grouphashes(group, all_grouphashes)

    is_regression = _process_existing_aggregate(
        group=group,
        event=job["event"],
        incoming_group_values=_get_group_processing_kwargs(job),
        release=job["release"],
    )

    return GroupInfo(group=group, is_new=False, is_regression=is_regression)


def create_group_with_grouphashes(job: Job, grouphashes: list[GroupHash]) -> GroupInfo | None:
    """
    Create a group from the data in `job` and link it to the given grouphashes.

    In very rare circumstances, we can end up in a race condition with another process trying to
    create the same group. If the current process loses the race, this function will update the
    group the other process just created, rather than creating a group itself.
    """
    event = job["event"]
    project = event.project

    # If the load-shed killswitch is enabled, this will raise a `HashDiscarded` error to pop us out
    # of this function all the way back to `save_error_events`, preventing group creation
    check_for_group_creation_load_shed(project, event)

    with (
        sentry_sdk.start_span(op="event_manager.create_group_transaction") as span,
        metrics.timer("event_manager.create_group_transaction") as metrics_timer_tags,
        transaction.atomic(router.db_for_write(GroupHash)),
    ):
        # These values will get overridden with whatever happens inside the lock if we do manage to
        # acquire it, so it should only end up with `wait-for-lock` if we don't
        span.set_tag("outcome", "wait_for_lock")
        metrics_timer_tags["outcome"] = "wait_for_lock"

        # If we're in this branch, we checked our grouphashes and didn't find one with a group
        # attached. We thus want to create a new group, but we need to guard against another
        # event with the same hash coming in before we're done here and also thinking it needs
        # to create a new group. To prevent this, we're using double-checked locking
        # (https://en.wikipedia.org/wiki/Double-checked_locking).

        # First, try to lock the relevant rows in the `GroupHash` table. If another (identically
        # hashed) event is also in the process of creating a group and has grabbed the lock
        # before us, we'll block here until it's done. If not, we've now got the lock and other
        # identically-hashed events will have to wait for us.
        grouphashes = list(
            GroupHash.objects.filter(
                id__in=[h.id for h in grouphashes],
            ).select_for_update()
        )

        # Now check again to see if any of our grouphashes have a group. In the first race
        # condition scenario above, we'll have been blocked long enough for the other event to
        # have created the group and updated our grouphashes with a group id, which means this
        # time, we'll find something.
        existing_grouphash = find_grouphash_with_group(grouphashes)

        # If we still haven't found a matching grouphash, we're now safe to go ahead and create
        # the group.
        if existing_grouphash is None:
            span.set_tag("outcome", "new_group")
            metrics_timer_tags["outcome"] = "new_group"
            record_new_group_metrics(event)

            group = _create_group(project, event, **_get_group_processing_kwargs(job))
            add_group_id_to_grouphashes(group, grouphashes)

            return GroupInfo(group=group, is_new=True, is_regression=False)

        # On the other hand, if we did in fact end up on the losing end of a race condition, treat
        # this the same way we would if we'd found a grouphash to begin with (and never landed in
        # this function at all)
        else:
            # TODO: should we be setting tags here, too?
            return handle_existing_grouphash(job, existing_grouphash, grouphashes)


def _create_group(
    project: Project,
    event: Event,
    *,
    first_release: Release | None = None,
    **group_creation_kwargs: Any,
) -> Group:

    short_id = _get_next_short_id(project)

    # it's possible the release was deleted between
    # when we queried for the release and now, so
    # make sure it still exists
    group_creation_kwargs["first_release_id"] = (
        Release.objects.filter(id=first_release.id).values_list("id", flat=True).first()
        if first_release
        else None
    )
    group_creation_kwargs["substatus"] = GroupSubStatus.NEW

    group_data = group_creation_kwargs.pop("data", {})

    # add sdk tag to metadata
    group_data.setdefault("metadata", {}).update(sdk_metadata_from_event(event))

    # add severity to metadata for alert filtering
    severity: Mapping[str, Any] = {}
    try:
        group_type = group_creation_kwargs.get("type", None)
        severity = _get_severity_metadata_for_group(event, project.id, group_type)
        group_data["metadata"].update(severity)
    except Exception as e:
        logger.exception(
            "Failed to get severity metadata for group",
            repr(e),
            extra={"event_id": event.event_id},
        )

    # the kwargs only include priority for non-error issue platform events, which takes precedence.
    priority = group_creation_kwargs.get("priority", None)
    if priority is None:
        priority = _get_priority_for_group(severity, group_creation_kwargs)

    group_creation_kwargs["priority"] = priority
    group_data["metadata"]["initial_priority"] = priority
    group_creation_kwargs["data"] = group_data

    try:
        with transaction.atomic(router.db_for_write(Group)):
            # This is the 99.999% path. The rest of the function is all to handle a very rare and
            # very confounding bug which keeps projects from creating new groups.
            group = Group.objects.create(
                project=project,
                short_id=short_id,
                **group_creation_kwargs,
            )

    # Attempt to handle The Mysterious Case of the Stuck Project Counter
    except IntegrityError as err:
        if not _is_stuck_counter_error(err, project, short_id):
            raise

        # Note: There is a potential race condition here, if two events simultaneously try to fix
        # the counter. Our hunch is that the only effect of that would be to over-increment, which
        # shouldn't cause any problems. Nonetheless, if we run into trouble with this workaround,
        # that's one thing to further investigate.
        new_short_id = _handle_stuck_project_counter(project, short_id)

        # Now that we've theoretically unstuck the counter, try again to create the group
        try:
            with transaction.atomic(router.db_for_write(Group)):
                group = Group.objects.create(
                    project=project,
                    short_id=new_short_id,
                    **group_creation_kwargs,
                )

        except Exception:
            # Maybe the stuck counter was hiding some other error
            logger.exception("Error after unsticking project counter")
            raise

    return group


def _is_stuck_counter_error(err: Exception, project: Project, short_id: int) -> bool:
    """Decide if this is `UniqueViolation` error on the `Group` table's project and short id values."""

    error_message = err.args[0]

    if not error_message.startswith("UniqueViolation"):
        return False

    for substring in [
        f"Key (project_id, short_id)=({project.id}, {short_id}) already exists.",
        'duplicate key value violates unique constraint "sentry_groupedmessage_project_id_short_id',
    ]:
        if substring in error_message:
            return True

    return False


def _handle_stuck_project_counter(project: Project, current_short_id: int) -> int:
    """
    Sometimes, for reasons unknown, a project's `Counter` value falls behind its latest group `short_id` value.
    When that happens, that incorrect counter value leads us to try to create groups with `short_id`s which
    are already taken.

    This handles that case by updating the counter's value to the latest group `short_id`, and then returns
    the new value.
    """
    new_short_id = current_short_id

    # Ordinarily running max on this many rows would be prohibitively expensive, but a) this is
    # a very rare case (< 20 ever that we know of), and b) project and short id are indexed
    # together in order to enforce the unique constraint which got us here in the first place,
    # so it's faster than it otherwise might be. We can time it just in case, though.
    with metrics.timer("stuck_project.max_short_id_query"):
        max_short_id_for_project = Group.objects.filter(project_id=project.id).aggregate(
            Max("short_id")
        )["short_id__max"]

    # Add 1 because we're trying to mimic a value which would already have been incremented
    correct_value = max_short_id_for_project + 1

    if current_short_id < correct_value:
        difference = correct_value - current_short_id
        # `_get_next_short_id` corrects the `Counter` value before it returns the new short_id
        new_short_id = _get_next_short_id(project, delta=difference)

        logger.info(
            "Fixed stuck counter value.", extra={"project": project.id, "difference": difference}
        )
        metrics.incr(
            "stuck_project.fixed_counter", tags={"difference": difference}, sample_rate=1.0
        )

    return new_short_id


def _get_next_short_id(project: Project, delta: int = 1) -> int:
    try:
        short_id = project.next_short_id(delta=delta)
    except OperationalError:
        metrics.incr("next_short_id.timeout")
        sentry_sdk.capture_message("short_id.timeout")
        raise HashDiscarded("Timeout when getting next_short_id", reason="timeout")

    return short_id


def _handle_regression(group: Group, event: BaseEvent, release: Release | None) -> bool | None:
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
        if not options.get("groups.enable-post-update-signal"):
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


def _is_placeholder_title(title):
    return title in PLACEHOLDER_EVENT_TITLES


def _is_real_title(title):
    return bool(title) and title not in PLACEHOLDER_EVENT_TITLES


def _get_updated_group_title(existing_container, incoming_container):
    """
    Given either `group.data` or `group.data["metadata"]`, in both existing and incoming forms, pick
    the correct title to use when updating the group. Uses the incoming title (or `None` if there
    isn't one) except in  the case where a placeholder title (`<unlabeled event>`, `<untitled>`,
    etc) would be replacing a non-placeholder title (either `None` or a real title).

    This stems from an incident during which we were interpreting error events as default-type
    events and thereby overwriting good titles with placeholder ones and inserting placeholder
    titles where there shouldn't have been a title at all. (The second case matters because
    default-type and error-type events differ in where they include a `title` attribute, and we
    count on the lack of a `title` attribute in certain cases as well as the presence of one.) This
    prevents that from happening in the future and will delete errant placeholder titles by
    overwriting them with `None`.
    """

    existing_title = existing_container.get("title")
    incoming_title = incoming_container.get("title")

    return (
        incoming_title
        if (
            # Real titles beat both placeholder and non-existent titles
            _is_real_title(incoming_title)
            or
            # Conversely, placeholder titles lose to both real titles and lack of a title (the
            # latter in order to fix the regression caused by error events being interpreted as
            # default-type events)
            _is_placeholder_title(existing_title)
        )
        else existing_title
    )


def _process_existing_aggregate(
    group: Group,
    event: BaseEvent,
    incoming_group_values: Mapping[str, Any],
    release: Release | None,
) -> bool:
    last_seen = max(event.datetime, group.last_seen)
    updated_group_values: dict[str, Any] = {"last_seen": last_seen}
    # Unclear why this is necessary, given that it's also in `updated_group_values`, but removing
    # it causes unrelated tests to fail. Hard to say if that's the tests or the removal, though.
    group.last_seen = updated_group_values["last_seen"]

    if (
        event.search_message
        and event.search_message != group.message
        and not _is_placeholder_title(event.search_message)
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

    existing_data = group.data
    existing_metadata = group.data.get("metadata", {})

    incoming_data = incoming_group_values["data"]
    incoming_metadata = incoming_group_values["data"].get("metadata", {})

    # Merge old and new data/metadata, keeping the existing title if the incoming title is a
    # placeholder (`<unlabeled event`, `<untitled>`, etc.) and the existing one isn't. See
    # `_get_updated_group_title` docstring.
    updated_group_values["data"] = {
        **existing_data,
        **incoming_data,
        "title": _get_updated_group_title(existing_data, incoming_data),
    }
    updated_group_values["data"]["metadata"] = {
        **existing_metadata,
        **incoming_metadata,
        "title": _get_updated_group_title(existing_metadata, incoming_metadata),
    }

    # We pass `times_seen` separately from all of the other columns so that `buffer_inr` knows to
    # increment rather than overwrite the existing value
    buffer_incr(Group, {"times_seen": 1}, {"id": group.id}, updated_group_values)

    return bool(is_regression)


severity_connection_pool = connection_from_url(
    settings.SEER_SEVERITY_URL,
    retries=settings.SEER_SEVERITY_RETRIES,
    timeout=settings.SEER_SEVERITY_TIMEOUT,  # Defaults to 300 milliseconds
)


def _get_severity_metadata_for_group(
    event: Event, project_id: int, group_type: int | None
) -> Mapping[str, Any]:
    """
    Returns severity metadata for an event if all of the following are true
    - the feature flag is enabled
    - the event platform supports severity
    - the event group type is an error

    Returns {} if conditions aren't met or on exception.
    """
    from sentry.receivers.rules import PLATFORMS_WITH_PRIORITY_ALERTS

    if killswitch_matches_context(
        "issues.severity.skip-seer-requests", {"project_id": event.project_id}
    ):
        logger.warning(
            "get_severity_metadata_for_group.seer_killswitch_enabled",
            extra={"event_id": event.event_id, "project_id": project_id},
        )
        metrics.incr("issues.severity.seer_killswitch_enabled")
        return {}

    seer_based_priority_enabled = features.has(
        "organizations:seer-based-priority", event.project.organization, actor=None
    )
    if not seer_based_priority_enabled:
        return {}

    feature_enabled = features.has("projects:first-event-severity-calculation", event.project)
    if not feature_enabled:
        return {}

    is_supported_platform = (
        any(event.platform.startswith(platform) for platform in PLATFORMS_WITH_PRIORITY_ALERTS)
        if event.platform
        else False
    )
    if not is_supported_platform:
        return {}

    is_error_group = group_type == ErrorGroupType.type_id if group_type else True
    if not is_error_group:
        return {}

    passthrough_data = options.get(
        "issues.severity.seer-circuit-breaker-passthrough-limit",
        CircuitBreakerPassthrough(limit=1, window=10),
    )
    if circuit_breaker_activated("sentry.seer.severity", passthrough_data=passthrough_data):
        logger.warning(
            "get_severity_metadata_for_group.circuit_breaker_activated",
            extra={"event_id": event.event_id, "project_id": project_id},
        )
        return {}

    from sentry import ratelimits as ratelimiter

    ratelimit = options.get("issues.severity.seer-global-rate-limit")
    # This is temporary until we update the option values to be a dict
    if "limit" not in ratelimit or "window" not in ratelimit:
        return {}

    if ratelimiter.backend.is_limited(
        "seer:severity-calculation:global-limit",
        limit=ratelimit["limit"],
        window=ratelimit["window"],
    ):
        logger.warning(
            "get_severity_metadata_for_group.rate_limited_globally",
            extra={"event_id": event.event_id, "project_id": project_id},
        )
        metrics.incr("issues.severity.rate_limited_globally")
        return {}

    ratelimit = options.get("issues.severity.seer-project-rate-limit")
    # This is temporary until we update the option values to be a dict
    if "limit" not in ratelimit or "window" not in ratelimit:
        return {}

    if ratelimiter.backend.is_limited(
        f"seer:severity-calculation:{project_id}",
        limit=ratelimit["limit"],
        window=ratelimit["window"],
    ):
        logger.warning(
            "get_severity_metadata_for_group.rate_limited_for_project",
            extra={"event_id": event.event_id, "project_id": project_id},
        )
        metrics.incr("issues.severity.rate_limited_for_project", tags={"project_id": project_id})
        return {}

    try:
        severity, reason = _get_severity_score(event)

        return {
            "severity": severity,
            "severity_reason": reason,
        }
    except Exception as e:
        logger.warning("Failed to calculate severity score for group", repr(e))
        update_severity_error_count()
        metrics.incr("issues.severity.error")
        return {}


def _get_priority_for_group(severity: Mapping[str, Any], kwargs: Mapping[str, Any]) -> int:
    """
    Returns priority for an event based on severity score and log level.
    """
    try:
        level = kwargs.get("level", None)
        severity_score = severity.get("severity", None)

        if level in [logging.INFO, logging.DEBUG]:
            return PriorityLevel.LOW

        elif level == logging.FATAL:
            return PriorityLevel.HIGH

        elif level == logging.WARNING:
            if severity_score is None or severity_score < HIGH_SEVERITY_THRESHOLD:
                return PriorityLevel.MEDIUM

            return PriorityLevel.HIGH  # severity_score >= HIGH_SEVERITY_THRESHOLD
        elif level == logging.ERROR:
            if severity_score is None or severity_score >= HIGH_SEVERITY_THRESHOLD:
                return PriorityLevel.HIGH

            return PriorityLevel.MEDIUM  # severity_score < HIGH_SEVERITY_THRESHOLD

        logger.warning("Unknown log level %s or severity score %s", level, severity_score)
        return PriorityLevel.MEDIUM
    except Exception as e:
        logger.exception(
            "Failed to calculate priority for group",
            repr(e),
            extra={
                "severity": severity,
                "kwargs": kwargs,
            },
        )

        return PriorityLevel.MEDIUM


def update_severity_error_count(reset=False) -> None:
    timeout = 60 * 60  # 1 hour
    if reset:
        cache.set(SEER_ERROR_COUNT_KEY, 0, timeout=timeout)
        return

    try:
        cache.incr(SEER_ERROR_COUNT_KEY)
        cache.touch(SEER_ERROR_COUNT_KEY, timeout=timeout)
    except ValueError:
        cache.set(SEER_ERROR_COUNT_KEY, 1, timeout=timeout)


def _get_severity_score(event: Event) -> tuple[float, str]:
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

    # If all we have is `<unlabeled event>` (or one of its equally unhelpful friends), bail
    if title in PLACEHOLDER_EVENT_TITLES:
        logger_data.update({"event_type": event_type.key, "title": title})
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

    with sentry_sdk.start_span(op=op):
        try:
            with metrics.timer(op):
                timeout = options.get(
                    "issues.severity.seer-timout",
                    settings.SEER_SEVERITY_TIMEOUT / 1000,
                )
                response = make_signed_seer_api_request(
                    severity_connection_pool,
                    "/v0/issues/severity-score",
                    body=orjson.dumps(payload),
                    timeout=timeout,
                )
                severity = orjson.loads(response.data).get("severity")
                reason = "ml"
        except MaxRetryError:
            reason = "microservice_max_retry"
            update_severity_error_count()
            metrics.incr("issues.severity.error", tags={"reason": "max_retries"})
            logger.exception("Seer severity microservice max retries exceeded")
        except TimeoutError:
            reason = "microservice_timeout"
            update_severity_error_count()
            metrics.incr("issues.severity.error", tags={"reason": "timeout"})
            logger.exception("Seer severity microservice timeout")
        except Exception:
            reason = "microservice_error"
            update_severity_error_count()
            metrics.incr("issues.severity.error", tags={"reason": "unknown"})
            logger.exception("Seer severity microservice error")
            sentry_sdk.capture_exception()
        else:
            update_severity_error_count(reset=True)

    return severity, reason


Attachment = CachedAttachment


@sentry_sdk.tracing.trace
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
            "sdk": normalized_sdk_tag_from_event(job["event"].data),
        },
    )


@sentry_sdk.tracing.trace
def get_attachments(cache_key: str | None, job: Job) -> list[Attachment]:
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


@sentry_sdk.tracing.trace
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


@sentry_sdk.tracing.trace
def save_attachment(
    cache_key: str | None,
    attachment: Attachment,
    project: Project,
    event_id: str,
    key_id: int | None = None,
    group_id: int | None = None,
    start_time: float | None = None,
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
        timestamp = datetime.now(timezone.utc)

    try:
        attachment.data
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
    from sentry import ratelimits as ratelimiter

    is_limited, num_requests, reset_time = ratelimiter.backend.is_limited_with_value(
        key="event_attachment.save_per_sec",
        limit=options.get("sentry.save-event-attachments.project-per-sec-limit"),
        project=project,
        window=1,
    )
    rate_limit_tag = "per_sec"
    if not is_limited:
        is_limited, num_requests, reset_time = ratelimiter.backend.is_limited_with_value(
            key="event_attachment.save_5_min",
            limit=options.get("sentry.save-event-attachments.project-per-5-minute-limit"),
            project=project,
            window=5 * 60,
        )
        rate_limit_tag = "per_five_min"
    if is_limited:
        metrics.incr(
            "event_manager.attachments.rate_limited", tags={"rate_limit_type": rate_limit_tag}
        )
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=key_id,
            outcome=Outcome.RATE_LIMITED,
            reason="rate_limited",
            timestamp=timestamp,
            event_id=event_id,
            category=DataCategory.ATTACHMENT,
            quantity=attachment.size or 1,
        )
        return

    file = EventAttachment.putfile(project.id, attachment)

    EventAttachment.objects.create(
        # lookup:
        project_id=project.id,
        group_id=group_id,
        event_id=event_id,
        # metadata:
        type=attachment.type,
        name=attachment.name,
        content_type=file.content_type,
        size=file.size,
        sha1=file.sha1,
        # storage:
        file_id=file.file_id,
        blob_path=file.blob_path,
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


def save_attachments(cache_key: str | None, attachments: list[Attachment], job: Job) -> None:
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


@sentry_sdk.tracing.trace
def _materialize_event_metrics(jobs: Sequence[Job]) -> None:
    for job in jobs:
        # Ensure the _metrics key exists. This is usually created during
        # and prefilled with ingestion sizes.
        event_metrics = job["event"].data.get("_metrics") or {}
        job["event"].data["_metrics"] = event_metrics

        # Capture the actual size that goes into node store.
        event_metrics["bytes.stored.event"] = len(
            orjson.dumps(dict(job["event"].data.items())).decode()
        )

        for metric_name in ("flag.processing.error", "flag.processing.fatal"):
            if event_metrics.get(metric_name):
                metrics.incr(f"event_manager.save.event_metrics.{metric_name}")

        job["event_metrics"] = event_metrics


@sentry_sdk.tracing.trace
def _calculate_span_grouping(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        # Make sure this snippet doesn't crash ingestion
        # as the feature is under development.
        try:
            event = job["event"]
            groupings = event.get_span_groupings()
            groupings.write_to_event(event.data)

            metrics.distribution("save_event.transaction.span_count", len(groupings.results))
            unique_default_hashes = set(groupings.results.values())
            metrics.incr(
                "save_event.transaction.span_group_count.default",
                amount=len(unique_default_hashes),
                tags={
                    "platform": job["platform"] or "unknown",
                    "sdk": normalized_sdk_tag_from_event(event.data),
                },
            )
        except Exception:
            sentry_sdk.capture_exception()


@sentry_sdk.tracing.trace
def _detect_performance_problems(
    jobs: Sequence[Job], projects: ProjectsMapping, is_standalone_spans: bool = False
) -> None:
    for job in jobs:
        job["performance_problems"] = detect_performance_problems(
            job["data"], projects[job["project_id"]], is_standalone_spans=is_standalone_spans
        )


@sentry_sdk.tracing.trace
def _record_transaction_info(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    """
    this function does what we do in post_process for transactions. if this option is
    turned on, we do the actions here instead of in post_process, with the goal
    eventually being to not run transactions through post_process
    """
    for job in jobs:
        try:
            event = job["event"]
            if not in_rollout_group("transactions.do_post_process_in_save", event.event_id):
                continue

            project = event.project
            with sentry_sdk.start_span(op="event_manager.record_transaction_name_for_clustering"):
                record_transaction_name_for_clustering(project, event.data)

            # these are what the "transaction_processed" signal hooked into
            # we should not use signals here, so call the recievers directly
            # instead of sending a signal. we should consider potentially
            # deleting these
            record_event_processed(project, event)
            record_user_context_received(project, event)
            record_release_received(project, event)
        except Exception:
            sentry_sdk.capture_exception()


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


def save_grouphash_and_group(
    project: Project,
    event: Event,
    new_grouphash: str,
    **group_kwargs: Any,
) -> tuple[Group, bool]:
    group = None
    with transaction.atomic(router.db_for_write(GroupHash)):
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


@sentry_sdk.tracing.trace
def _send_occurrence_to_platform(jobs: Sequence[Job], projects: ProjectsMapping) -> None:
    for job in jobs:
        event = job["event"]
        project = event.project
        event_id = event.event_id

        performance_problems = job["performance_problems"]
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


@sentry_sdk.tracing.trace
def save_transaction_events(jobs: Sequence[Job], projects: ProjectsMapping) -> Sequence[Job]:
    from .ingest.types import ConsumerType

    organization_ids = {project.organization_id for project in projects.values()}
    organizations = {o.id: o for o in Organization.objects.get_many_from_cache(organization_ids)}

    with metrics.timer("save_transaction_events.set_organization_cached_field_values"):
        for project in projects.values():
            try:
                project.set_cached_field_value(
                    "organization", organizations[project.organization_id]
                )
            except KeyError:
                continue

    set_measurement(measurement_name="jobs", value=len(jobs))
    set_measurement(measurement_name="projects", value=len(projects))

    with metrics.timer("save_transaction_events.get_or_create_release_many"):
        _get_or_create_release_many(jobs, projects)

    with metrics.timer("save_transaction_events.get_event_user_many"):
        _get_event_user_many(jobs, projects)

    with metrics.timer("save_transaction_events.derive_plugin_tags_many"):
        _derive_plugin_tags_many(jobs, projects)

    with metrics.timer("save_transaction_events.derive_interface_tags_many"):
        _derive_interface_tags_many(jobs)

    with metrics.timer("save_transaction_events.calculate_span_grouping"):
        _calculate_span_grouping(jobs, projects)

    with metrics.timer("save_transaction_events.materialize_metadata_many"):
        _materialize_metadata_many(jobs)

    with metrics.timer("save_transaction_events.get_or_create_environment_many"):
        _get_or_create_environment_many(jobs, projects)

    with metrics.timer("save_transaction_events.get_or_create_release_associated_models"):
        _get_or_create_release_associated_models(jobs, projects)

    with metrics.timer("save_transaction_events.tsdb_record_all_metrics"):
        _tsdb_record_all_metrics(jobs)

    with metrics.timer("save_transaction_events.materialize_event_metrics"):
        _materialize_event_metrics(jobs)

    with metrics.timer("save_transaction_events.nodestore_save_many"):
        _nodestore_save_many(jobs=jobs, app_feature="transactions")

    with metrics.timer("save_transaction_events.eventstream_insert_many"):
        _eventstream_insert_many(jobs)

    for job in jobs:
        track_sampled_event(
            job["event"].event_id,
            ConsumerType.Transactions,
            TransactionStageStatus.SNUBA_TOPIC_PUT,
        )

    with metrics.timer("save_transaction_events.track_outcome_accepted_many"):
        _track_outcome_accepted_many(jobs)

    with metrics.timer("save_transaction_events.detect_performance_problems"):
        _detect_performance_problems(jobs, projects)

    with metrics.timer("save_transaction_events.send_occurrence_to_platform"):
        _send_occurrence_to_platform(jobs, projects)

    with metrics.timer("save_transaction_events.record_transaction_info"):
        _record_transaction_info(jobs, projects)

    return jobs


@sentry_sdk.tracing.trace
def save_generic_events(jobs: Sequence[Job], projects: ProjectsMapping) -> Sequence[Job]:
    organization_ids = {project.organization_id for project in projects.values()}
    organizations = {o.id: o for o in Organization.objects.get_many_from_cache(organization_ids)}

    for project in projects.values():
        try:
            project.set_cached_field_value("organization", organizations[project.organization_id])
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
