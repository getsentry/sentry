from __future__ import annotations

import logging
from collections import defaultdict
from datetime import timedelta
from typing import Any

from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from sentry import features, options, quotas
from sentry.constants import HIDE_AI_FEATURES_DEFAULT, DataCategory, ObjectStatus
from sentry.issues.impact.assessment import assess_impact_for_group
from sentry.issues.impact.types import IMPACT_FEATURE_ID
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization, OrganizationStatus
from sentry.models.project import Project
from sentry.ratelimits import backend as ratelimiter
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
# Each page of ranked candidates fetches this multiple of the per-run limit.
CANDIDATE_PAGE_SIZE_FACTOR = 5
# The highest-volume issues stay on top day after day, so once they're assessed
# the first page can come back empty. Page further down the ranking, up to this
# many pages, to find unassessed issues.
MAX_CANDIDATE_PAGES = 5
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
        # When the batch check is unavailable, queue anyway; the per-project
        # task checks the flag again.
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

    Currently picks the top groups for a project sorted by occurrence count within the last 24h,
    skipping any groups we've attempted (success or not) to assess in the past.

    Goes through `MAX_CANDIDATE_PAGES` of the query or until `limit` number of groups are found.
    """
    if limit <= 0:
        return []

    page_size = limit * CANDIDATE_PAGE_SIZE_FACTOR
    candidates: list[Group] = []
    for page in range(MAX_CANDIDATE_PAGES):
        ranked_group_ids = get_top_groups_by_occurrence_count(
            project, offset=page * page_size, limit=page_size
        )
        if not ranked_group_ids:
            break

        assessed = set(
            SeerAgentRun.objects.filter(
                group_id__in=ranked_group_ids, source=IMPACT_FEATURE_ID
            ).values_list("group_id", flat=True)
        )
        groups_by_id = {
            g.id: g
            for g in Group.objects.filter(
                id__in=[gid for gid in ranked_group_ids if gid not in assessed],
                project_id=project.id,
                status=GroupStatus.UNRESOLVED,
            ).select_related("project", "project__organization")
        }
        candidates.extend(groups_by_id[gid] for gid in ranked_group_ids if gid in groups_by_id)

        if len(candidates) >= limit or len(ranked_group_ids) < page_size:
            break

    metrics.distribution("issues.impact.scheduled.candidate_pages", page + 1, sample_rate=1.0)
    return candidates[:limit]


def get_top_groups_by_occurrence_count(project: Project, *, offset: int, limit: int) -> list[int]:
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
        orderby=["-count()"],
        offset=offset,
        limit=limit,
        referrer=Referrer.ISSUES_IMPACT_SCHEDULED_CANDIDATES.value,
        config=SearchResolverConfig(),
    )
    return [int(row["group_id"]) for row in result["data"] if row.get("group_id")]


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
