from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from django.core.cache import cache
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from sentry import features, options, quotas
from sentry.constants import HIDE_AI_FEATURES_DEFAULT, DataCategory, ObjectStatus
from sentry.issues.impact.assessment import (
    ImpactAssessmentDisabled,
    ImpactAssessmentEventNotFound,
    assess_impact_for_group,
)
from sentry.issues.impact.types import IMPACT_FEATURE_ID
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.ratelimits import backend as ratelimiter
from sentry.search.eap.occurrences.query_utils import build_group_id_in_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.models.run import SeerAgentRun
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)

IMPACT_FEATURE_FLAG = "organizations:seer-impact-assessment"
CANDIDATE_LOOKBACK = timedelta(hours=24)
# Matches the issue stream's snuba.search.max-pre-snuba-candidates default.
MAX_PRE_SNUBA_CANDIDATES = 5000
# Rank more groups than needed so skipping recent no-event groups still fills the limit.
CANDIDATE_OVERFETCH_FACTOR = 5
NO_EVENT_RETRY_SECONDS = 60 * 60 * 24
# Per-project tasks are spread across this window so they don't all fire at
# once, while still finishing well before the next hourly tick.
PROJECT_SPREAD_SECONDS = 50 * 60
DAILY_WINDOW_SECONDS = 60 * 60 * 24


@instrumented_task(
    name="sentry.issues.impact.tasks.schedule_impact_assessments",
    namespace=seer_tasks,
    processing_deadline_duration=60,
)
def schedule_impact_assessments(**kwargs: Any) -> None:
    if not options.get("issues.impact.scheduled.enable"):
        return

    projects_by_org: dict[Organization, list[Project]] = defaultdict(list)
    for project in get_scheduled_projects():
        projects_by_org[project.organization].append(project)
    if not projects_by_org:
        return

    flagged = features.batch_has_for_organizations(IMPACT_FEATURE_FLAG, list(projects_by_org))
    for organization, projects in projects_by_org.items():
        # Even if the batch check errors out, queue anyway since we check again on the project task
        if flagged is not None and not flagged.get(f"organization:{organization.id}", False):
            record_skip(reason="feature_disabled", count=len(projects))
            continue
        for project in projects:
            delay = int(md5_text(str(project.id)).hexdigest(), 16) % PROJECT_SPREAD_SECONDS
            run_impact_assessments_for_project.apply_async(
                args=[project.id],
                countdown=delay,
                headers={"sentry-propagate-traces": False},
            )
            metrics.incr("issues.impact.scheduled.project_dispatched", sample_rate=1.0)


def get_scheduled_projects() -> list[Project]:
    organization_ids = [int(oid) for oid in options.get("issues.impact.scheduled.organization_ids")]
    project_ids = [int(pid) for pid in options.get("issues.impact.scheduled.project_ids")]
    if not organization_ids and not project_ids:
        return []

    recent_unresolved_issue = Group.objects.filter(
        project_id=OuterRef("id"),
        status=GroupStatus.UNRESOLVED,
        last_seen__gte=timezone.now() - CANDIDATE_LOOKBACK,
    )
    return list(
        Project.objects.filter(
            Q(organization_id__in=organization_ids) | Q(id__in=project_ids),
            Exists(recent_unresolved_issue),
            status=ObjectStatus.ACTIVE,
        ).select_related("organization")
    )


@instrumented_task(
    name="sentry.issues.impact.tasks.run_impact_assessments_for_project",
    namespace=seer_tasks,
    processing_deadline_duration=5 * 60,
)
def run_impact_assessments_for_project(project_id: int, **kwargs: Any) -> None:
    if not options.get("issues.impact.scheduled.enable"):
        record_skip(reason="disabled")
        return

    project = (
        Project.objects.filter(status=ObjectStatus.ACTIVE)
        .select_related("organization")
        .get_or_none(id=project_id)
    )
    if project is None:
        record_skip(reason="project_inactive")
        return

    skip_reason = get_organization_skip_reason(organization=project.organization)
    if skip_reason is not None:
        record_skip(reason=skip_reason)
        return

    limit = options.get("issues.impact.scheduled.issues_per_project")
    for group in select_impact_candidates(project=project, limit=limit):
        if has_organization_reached_daily_cap(organization=project.organization):
            record_skip(reason="org_daily_cap")
            return
        try:
            assess_impact_for_group(group=group)
        except ImpactAssessmentDisabled:
            record_skip(reason="feature_disabled")
            return
        except ImpactAssessmentEventNotFound:
            # No SeerAgentRun is created, so without this the issue would be
            # picked again every hour and keep using the org's daily cap.
            cache.set(no_event_cache_key(group.id), True, NO_EVENT_RETRY_SECONDS)
            record_skip(reason="no_event")
            continue
        except Exception:
            logger.exception(
                "issues.impact.scheduled.dispatch_failed",
                extra={
                    "organization_id": project.organization_id,
                    "project_id": project.id,
                    "group_id": group.id,
                },
            )
            metrics.incr("issues.impact.scheduled.dispatch_failed", sample_rate=1.0)
            continue
        metrics.incr("issues.impact.scheduled.dispatched", sample_rate=1.0)


def get_organization_skip_reason(organization: Organization) -> str | None:
    if organization.status != OrganizationStatus.ACTIVE:
        return "org_inactive"
    if organization.get_option("sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT):
        return "hide_ai_features"
    if not features.has(IMPACT_FEATURE_FLAG, organization):
        return "feature_disabled"
    if not quotas.backend.check_seer_quota(
        org_id=organization.id, data_category=DataCategory.SEER_SCANNER
    ):
        return "no_seer_quota"
    return None


def select_impact_candidates(project: Project, limit: int) -> list[Group]:
    """
    Picks which groups are going to have their impact assessed.

    Picks the top groups for a project sorted by occurrence count within the last 24h,
    skipping any groups we've assessed in the past or recently failed to find an event for.

    Like the issue stream, Postgres filters the eligible groups first, then Snuba ranks
    only those.
    """
    if limit <= 0:
        return []

    eligible_group_ids = list(
        Group.objects.filter(
            project_id=project.id,
            status=GroupStatus.UNRESOLVED,
            last_seen__gte=timezone.now() - CANDIDATE_LOOKBACK,
        )
        .exclude(
            Exists(SeerAgentRun.objects.filter(group_id=OuterRef("id"), source=IMPACT_FEATURE_ID))
        )
        # NOTE: Anything past MAX_PRE_SNUBA_CANDAITES is not ranked, so busy groups from a while ago
        # will be missed if the project has a lot more recent issues.
        # We could resolve this by ranking without a group_id filter, similar to the fallback
        # used in the issue stream executor, but skipping it for now.
        # https://github.com/getsentry/sentry/blob/2d4776b4b00ee3a21a819fb90680cf02d686646e/src/sentry/search/snuba/executors.py#L1898-L1911
        .order_by("-last_seen")
        .values_list("id", flat=True)[:MAX_PRE_SNUBA_CANDIDATES]
    )
    metrics.distribution(
        "issues.impact.scheduled.num_candidates", len(eligible_group_ids), sample_rate=1.0
    )
    if not eligible_group_ids:
        return []

    ranked_group_ids = get_top_groups_by_occurrence_count(
        project=project, group_ids=eligible_group_ids, limit=limit * CANDIDATE_OVERFETCH_FACTOR
    )
    no_event = cache.get_many([no_event_cache_key(gid) for gid in ranked_group_ids])
    ranked_group_ids = [gid for gid in ranked_group_ids if no_event_cache_key(gid) not in no_event]
    groups_by_id = Group.objects.select_related("project", "project__organization").in_bulk(
        ranked_group_ids[:limit]
    )
    return [groups_by_id[gid] for gid in ranked_group_ids[:limit] if gid in groups_by_id]


def get_top_groups_by_occurrence_count(
    *, project: Project, group_ids: Sequence[int], limit: int
) -> list[int]:
    now = timezone.now()
    result = Occurrences.run_table_query(
        params=SnubaParams(
            start=now - CANDIDATE_LOOKBACK,
            end=now,
            organization=project.organization,
            projects=[project],
        ),
        query_string="",
        selected_columns=["group_id", "count()"],
        # group_id breaks ties so the ranking is stable when counts are equal.
        orderby=["-count()", "group_id"],
        offset=0,
        limit=limit,
        referrer=Referrer.ISSUES_IMPACT_SCHEDULED_CANDIDATES.value,
        config=SearchResolverConfig(),
        extra_conditions=build_group_id_in_filter(group_ids),
    )
    return [int(row["group_id"]) for row in result["data"] if row.get("group_id")]


def no_event_cache_key(group_id: int) -> str:
    return f"issues.impact.scheduled:no_event:{group_id}"


def has_organization_reached_daily_cap(organization: Organization) -> bool:
    return ratelimiter.is_limited(
        f"issues.impact.scheduled:org:{organization.id}",
        limit=options.get("issues.impact.scheduled.max_dispatches_per_org_per_day"),
        window=DAILY_WINDOW_SECONDS,
    )


def record_skip(*, reason: str, count: int = 1) -> None:
    metrics.incr(
        "issues.impact.scheduled.skipped", amount=count, tags={"reason": reason}, sample_rate=1.0
    )
