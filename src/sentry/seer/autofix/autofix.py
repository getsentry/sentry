from __future__ import annotations

import concurrent.futures
import logging
from datetime import datetime, timedelta
from typing import Any

import orjson
import requests
import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework.response import Response

from sentry import features, quotas, tagstore
from sentry.api.endpoints.organization_trace import OrganizationTraceEndpoint
from sentry.api.serializers import EventSerializer, serialize
from sentry.constants import DataCategory, ObjectStatus
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.issues.grouptype import WebVitalsGroup
from sentry.models.commitauthor import CommitAuthor
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    get_autofix_repos_from_project_code_mappings,
)
from sentry.seer.explorer.utils import _convert_profile_to_execution_tree, fetch_profile_data
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.services import eventstore
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.tasks.autofix import check_autofix_status
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

logger = logging.getLogger(__name__)


TIMEOUT_SECONDS = 60 * 30  # 30 minutes


def _get_logs_for_event(
    event: Event | GroupEvent, project: Project
) -> dict[str, list[dict]] | None:
    trace_id = event.trace_id
    if not trace_id:
        return None

    projects_qs = Project.objects.filter(
        organization=project.organization, status=ObjectStatus.ACTIVE
    )
    projects = list(projects_qs)
    project_id_to_slug = dict(projects_qs.values_list("id", "slug"))
    start = event.datetime - timedelta(days=1)
    end = event.datetime + timedelta(days=1)

    snuba_params = SnubaParams(
        start=start,
        end=end,
        projects=projects,
        organization=project.organization,
    )

    results: EventsResponse = OurLogs.run_table_query(
        params=snuba_params,
        query_string=f"trace:{trace_id}",
        selected_columns=[
            "project.id",
            "timestamp",
            "message",
            "severity",
            "code.file.path",
            "code.function.name",
        ],
        orderby=["-timestamp"],
        offset=0,
        limit=100,
        referrer=Referrer.API_GROUP_AI_AUTOFIX,
        config=SearchResolverConfig(use_aggregate_conditions=False),
    )
    data = results["data"]

    # Convert log timestamps to datetime and sort by timestamp ascending (oldest first)
    for log in data:
        ts = log.get("timestamp")
        if ts:
            try:
                log["_parsed_ts"] = datetime.fromisoformat(ts)
            except Exception:
                log["_parsed_ts"] = None
        else:
            log["_parsed_ts"] = None

    # Sort logs by timestamp ascending (oldest first)
    data.sort(key=lambda x: x.get("_parsed_ts") or datetime.min)

    # Find the index of the log closest to the event timestamp (faster with min and enumerate)
    closest_idx = 0
    if data:
        valid_logs = [(i, log) for i, log in enumerate(data) if log.get("_parsed_ts") is not None]
        if valid_logs:
            closest_idx, _ = min(
                (
                    (i, abs((log["_parsed_ts"] - event.datetime).total_seconds()))
                    for i, log in valid_logs
                ),
                key=lambda x: x[1],
                default=(0, None),
            )

    # Select up to 80 logs before and up to 20 logs after (including the closest)
    start_idx = max(0, closest_idx - 80)
    end_idx = min(len(data), closest_idx + 21)
    window = data[start_idx:end_idx]

    # Merge and count consecutive logs with identical message and severity
    merged_logs = []
    prev_log = None
    count = 0
    for log in window:
        project_id = log.get("project.id")
        log["project_slug"] = project_id_to_slug.get(project_id) if project_id else None
        log["code_file_path"] = log.get("code.file.path")
        log["code_function_name"] = log.get("code.function.name")
        log.pop("code.file.path", None)
        log.pop("code.function.name", None)
        log.pop("_parsed_ts", None)
        log.pop("project.id", None)

        msg = log.get("message")
        sev = log.get("severity")
        if prev_log and msg == prev_log["message"] and sev == prev_log["severity"]:
            count += 1
        else:
            if prev_log:
                if count > 1:
                    prev_log["consecutive_count"] = count
                merged_logs.append(prev_log)
            prev_log = log.copy()
            count = 1
    if prev_log:
        if count > 1:
            prev_log["consecutive_count"] = count
        merged_logs.append(prev_log)

    return {
        "logs": merged_logs,
    }


def _get_serialized_event(
    event_id: str, group: Group, user: User | RpcUser | AnonymousUser
) -> tuple[dict[str, Any] | None, Event | GroupEvent | None]:
    event = eventstore.backend.get_event_by_id(group.project.id, event_id, group_id=group.id)

    if not event:
        return None, None

    serialized_event = serialize(event, user, EventSerializer())
    return serialized_event, event


def _get_trace_tree_for_event(
    event: Event | GroupEvent, project: Project, timeout: int = 15
) -> dict[str, Any] | None:
    """
    Returns the full trace for the given issue event with a timeout (default 15 seconds).
    Returns None if the timeout expires or if the trace cannot be fetched.
    """
    trace_id = event.trace_id
    if not trace_id:
        return None

    def _fetch_trace():
        projects_qs = Project.objects.filter(
            organization=project.organization, status=ObjectStatus.ACTIVE
        )
        projects = list(projects_qs)
        end = event.datetime + timedelta(days=1)
        # Web Vital issues are synthetic and don't necessarily occur at the same time as associated traces
        # Don't restrict time range in these scenarios, ie use 90 day range
        if event.group and event.group.issue_type.slug == WebVitalsGroup.slug:
            start = event.datetime - timedelta(days=89)
        else:
            start = event.datetime - timedelta(days=1)

        snuba_params = SnubaParams(
            start=start,
            end=end,
            projects=projects,
            organization=project.organization,
        )

        trace_endpoint = OrganizationTraceEndpoint()
        trace = trace_endpoint.query_trace_data(snuba_params, trace_id)

        if not trace:
            logger.info(
                "[Autofix] No trace found for event",
                extra={
                    "event_id": event.event_id,
                    "trace_id": trace_id,
                    "org_slug": project.organization.slug,
                    "project_slug": project.slug,
                },
            )
            return None

        logger.info(
            "[Autofix] Found trace for event",
            extra={
                "event_id": event.event_id,
                "trace_id": trace_id,
                "org_slug": project.organization.slug,
                "project_slug": project.slug,
                "num_root_nodes": len(trace),
            },
        )
        return {
            "trace_id": trace_id,
            "org_id": project.organization_id,
            "trace": trace,
        }

    try:
        with sentry_sdk.start_span(op="seer.autofix.get_trace_tree_for_event"):
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(_fetch_trace)
                return future.result(timeout=timeout)
    except concurrent.futures.TimeoutError:
        logger.warning(
            "[Autofix] Timeout expired while fetching trace tree for event",
            extra={
                "event_id": event.event_id,
                "trace_id": trace_id,
                "project_id": project.id,
                "timeout": timeout,
            },
        )
        return None
    except Exception:
        logger.exception("Error fetching trace tree for event")
        return None


def _get_profile_from_trace_tree(
    trace_tree: dict[str, Any] | None, event: Event | GroupEvent | None, project: Project
) -> dict[str, Any] | None:
    """
    Finds a profile for a span that contains our error event.
    """
    if not trace_tree or not event:
        return None

    events = trace_tree.get("trace", [])
    event_transaction_name = event.transaction

    if not event_transaction_name:
        return None

    # Flatten all events in the tree for easier traversal
    all_events = []

    def _collect_all_events(node):
        all_events.append(node)
        for child in node.get("children", []):
            _collect_all_events(child)

    for root_node in events:
        _collect_all_events(root_node)

    # Find the first span that matches the event's transaction name and has a profile
    matching_transaction = None
    for node in all_events:
        if node.get("description") == event_transaction_name and (
            node.get("profile_id") or node.get("profiler_id")
        ):
            matching_transaction = node
            break

    if not matching_transaction:
        logger.info(
            "[Autofix] No matching transaction found for event; could not find a profile",
            extra={
                "event_id": event.event_id,
                "trace_id": trace_tree.get("trace_id"),
                "org_slug": project.organization.slug,
                "project_slug": project.slug,
                "available_descriptions": [node.get("description") for node in all_events],
                "event_transaction_name": event_transaction_name,
            },
        )
        return None

    raw_profile_id = matching_transaction.get("profile_id")
    raw_profiler_id = matching_transaction.get("profiler_id")

    profile_id = raw_profile_id or raw_profiler_id
    is_continuous = raw_profiler_id and not raw_profile_id
    if not profile_id:
        return None
    start_ts = matching_transaction.get("start_timestamp")
    end_ts = matching_transaction.get("end_timestamp")

    profile = fetch_profile_data(
        profile_id=profile_id,
        organization_id=project.organization_id,
        project_id=project.id,
        start_ts=start_ts,
        end_ts=end_ts,
        is_continuous=is_continuous,
    )

    if profile:
        execution_tree, _ = _convert_profile_to_execution_tree(profile)
        return (
            None
            if not execution_tree
            else {
                "profile_matches_issue": True,  # we don't have a fallback for now
                "execution_tree": execution_tree,
            }
        )

    return None


def _respond_with_error(reason: str, status: int):
    return Response(
        {
            "detail": reason,
        },
        status=status,
    )


def _get_github_username_for_user(user: User | RpcUser, organization_id: int) -> str | None:
    """
    Get GitHub username for a user by checking multiple sources.

    This function attempts to resolve a Sentry user to their GitHub username by:
    1. Checking ExternalActor for explicit user→GitHub mappings
    2. Falling back to CommitAuthor records matched by email (like suspect commits)
    3. Extracting the GitHub username from the CommitAuthor external_id
    """
    # Method 1: Check ExternalActor for direct user→GitHub mapping
    external_actor: ExternalActor | None = (
        ExternalActor.objects.filter(
            user_id=user.id,
            organization_id=organization_id,
            provider__in=[
                ExternalProviders.GITHUB.value,
                ExternalProviders.GITHUB_ENTERPRISE.value,
            ],
        )
        .order_by("-date_added")
        .first()
    )

    if external_actor and external_actor.external_name:
        username = external_actor.external_name
        return username[1:] if username.startswith("@") else username

    # Method 2: Check CommitAuthor by email matching (like suspect commits does)
    # Get all verified emails for this user
    user_emails: list[str] = []
    try:
        # Both User and RpcUser models have a get_verified_emails method
        if hasattr(user, "get_verified_emails"):
            verified_emails = user.get_verified_emails()
            user_emails.extend([e.email for e in verified_emails])
    except Exception:
        # If we can't get verified emails, don't use any
        pass

    if user_emails:
        # Find CommitAuthors with matching emails that have GitHub external_id
        commit_author = (
            CommitAuthor.objects.filter(
                organization_id=organization_id,
                email__in=[email.lower() for email in user_emails],
                external_id__isnull=False,
            )
            .exclude(external_id="")
            .order_by("-id")
            .first()
        )

        if commit_author:
            commit_username = commit_author.get_username_from_external_id()
            if commit_username:
                return commit_username

    return None


def _call_autofix(
    *,
    user: User | AnonymousUser | RpcUser,
    group: Group,
    repos: list[dict],
    serialized_event: dict[str, Any],
    profile: dict[str, Any] | None,
    trace_tree: dict[str, Any] | None,
    logs: dict[str, list[dict]] | None,
    tags_overview: dict[str, Any] | None,
    instruction: str | None = None,
    timeout_secs: int = TIMEOUT_SECONDS,
    pr_to_comment_on_url: str | None = None,
    auto_run_source: str | None = None,
    stopping_point: AutofixStoppingPoint | None = None,
    github_username: str | None = None,
):
    path = "/v1/automation/autofix/start"
    body = orjson.dumps(
        {
            "organization_id": group.organization.id,
            "project_id": group.project.id,
            "repos": repos,
            "issue": {
                "id": group.id,
                "title": group.title,
                "short_id": group.qualified_short_id,
                "first_seen": group.first_seen.isoformat(),
                "events": [serialized_event],
            },
            "profile": profile,
            "trace_tree": trace_tree,
            "logs": logs,
            "tags_overview": tags_overview,
            "instruction": instruction,
            "timeout_secs": timeout_secs,
            "last_updated": datetime.now().isoformat(),
            "invoking_user": (
                {
                    "id": user.id,
                    "display_name": user.get_display_name(),
                    "github_username": github_username,
                }
                if not isinstance(user, AnonymousUser)
                else None
            ),
            "options": {
                "comment_on_pr_with_url": pr_to_comment_on_url,
                "auto_run_source": auto_run_source,
                "disable_coding_step": not group.organization.get_option(
                    "sentry:enable_seer_coding", default=True
                ),
                "stopping_point": stopping_point,
            },
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()

    return response.json().get("run_id")


def get_all_tags_overview(group: Group) -> dict[str, Any] | None:
    """
    Get high-level overview of all tags for an issue.
    Returns aggregated tag data with percentages for all tags.
    """
    tag_keys = tagstore.backend.get_group_tag_keys_and_top_values(
        group,
        [],  # all environments
        keys=None,  # Get all tags
        value_limit=3,  # Get top 3 values per tag
        tenant_ids={"organization_id": group.project.organization_id},
    )

    all_tags: list[dict] = []

    KEYS_TO_EXCLUDE = {
        "release",
        "browser.name",  # the 'browser' tag is better
        "device.class",
        "mechanism",
        "os.name",  # the 'os' tag is better
        "runtime.name",  # the 'runtime' tag is better
        "replay_id",
        "replayid",
        "level",
    }  # tags we think are useless for Autofix
    for tag in tag_keys:
        if tag.key.lower() in KEYS_TO_EXCLUDE:
            continue

        # Calculate percentages for each tag value
        tag_data = {
            "key": tag.key,
            "name": tagstore.backend.get_tag_key_label(tag.key),
            "total_values": tag.count,
            "unique_values": getattr(tag, "values_seen", 0),
            "top_values": [],
        }

        if hasattr(tag, "top_values") and tag.top_values:
            # Calculate total from top values
            top_values_total = sum(tag_value.times_seen for tag_value in tag.top_values)

            for tag_value in tag.top_values:
                percentage = round((tag_value.times_seen / tag.count) * 100) if tag.count > 0 else 0

                # Ensure no single value shows 100% when there are multiple values
                has_multiple_values = len(tag.top_values) > 1 or top_values_total < tag.count
                if has_multiple_values and percentage >= 100:
                    percentage = ">99"
                elif percentage < 1:
                    percentage = "<1"

                tag_data["top_values"].append(
                    {
                        "value": tag_value.value,
                        "count": tag_value.times_seen,
                        "percentage": (
                            f"{percentage}%" if isinstance(percentage, (int, float)) else percentage
                        ),
                    }
                )

            # Add "other" category if there are more values than the top values shown
            if top_values_total < tag.count:
                other_count = tag.count - top_values_total
                other_percentage = round((other_count / tag.count) * 100) if tag.count > 0 else 0

                # Apply the same percentage formatting rules
                if other_percentage < 1:
                    other_percentage_str = "<1%"
                elif len(tag.top_values) > 0 and other_percentage >= 100:
                    other_percentage_str = ">99%"
                else:
                    other_percentage_str = f"{other_percentage}%"

                tag_data["top_values"].append(
                    {
                        "value": "other",
                        "count": other_count,
                        "percentage": other_percentage_str,
                    }
                )

        if tag_data["top_values"]:  # Only include tags that have values
            all_tags.append(tag_data)

    logger.info(
        "[Autofix] Retrieved all tags overview",
        extra={
            "group_id": group.id,
            "org_slug": group.project.organization.slug,
            "project_slug": group.project.slug,
            "total_tags_count": len(all_tags),
            "total_tags_checked": len(tag_keys),
            "tag_overview": all_tags[:5],  # only log up to the first 5 results
        },
    )
    return {
        "tags_overview": all_tags,
    }


def trigger_autofix(
    *,
    group: Group,
    event_id: str | None = None,
    user: User | AnonymousUser | RpcUser,
    instruction: str | None = None,
    pr_to_comment_on_url: str | None = None,
    auto_run_source: str | None = None,
    stopping_point: AutofixStoppingPoint | None = None,
):
    if not features.has("organizations:gen-ai-features", group.organization, actor=user):
        return _respond_with_error("AI Autofix is not enabled for this project.", 403)

    if group.organization.get_option("sentry:hide_ai_features"):
        return _respond_with_error("AI features are disabled for this organization.", 403)

    if not get_seer_org_acknowledgement(group.organization):
        return _respond_with_error(
            "Seer has not been enabled for this organization. Please open an issue at sentry.io/issues and set up Seer.",
            403,
        )

    # check billing quota for autofix
    has_budget: bool = quotas.backend.check_seer_quota(
        org_id=group.organization.id,
        data_category=DataCategory.SEER_AUTOFIX,
    )
    if not has_budget:
        return _respond_with_error("No budget for Seer Autofix.", 402)

    if event_id is None:
        event: Event | GroupEvent | None = group.get_recommended_event_for_environments()
        if not event:
            event = group.get_latest_event()

        if not event:
            return Response(
                {
                    "detail": "Could not find an event for the issue, please try providing an event_id"
                },
                status=400,
            )
        event_id = event.event_id

    # For now we only send the event that the user is looking at, in the near future we want to send multiple events.
    serialized_event, event = _get_serialized_event(event_id, group, user)

    if serialized_event is None:
        return _respond_with_error("Cannot fix issues without an event.", 400)

    repos = get_autofix_repos_from_project_code_mappings(group.project)

    # get trace tree of transactions and errors for this event
    try:
        trace_tree = _get_trace_tree_for_event(event, group.project) if event else None
    except Exception:
        logger.exception("Failed to get trace tree for event")
        trace_tree = None

    # find the profile containing our error event
    try:
        profile = _get_profile_from_trace_tree(trace_tree, event, group.project) if event else None
    except Exception:
        logger.exception("Failed to get profile from trace tree")
        profile = None

    # get logs for this event
    try:
        logs = _get_logs_for_event(event, group.project) if event else None
    except Exception:
        logger.exception("Failed to get logs for event")
        logs = None

    # get all tags overview for this issue
    try:
        tags_overview = get_all_tags_overview(group)
    except Exception:
        logger.exception("Failed to get tags overview")
        tags_overview = None

    # get github username for user
    github_username = None
    if not isinstance(user, AnonymousUser):
        github_username = _get_github_username_for_user(user, group.organization.id)

    try:
        run_id = _call_autofix(
            user=user,
            group=group,
            repos=repos,
            serialized_event=serialized_event,
            profile=profile,
            trace_tree=trace_tree,
            logs=logs,
            tags_overview=tags_overview,
            instruction=instruction,
            timeout_secs=TIMEOUT_SECONDS,
            pr_to_comment_on_url=pr_to_comment_on_url,
            auto_run_source=auto_run_source,
            stopping_point=stopping_point,
            github_username=github_username,
        )
    except Exception:
        logger.exception("Failed to send autofix to seer")

        return _respond_with_error(
            "Autofix failed to start.",
            500,
        )

    check_autofix_status.apply_async(
        args=[run_id, group.organization.id], countdown=timedelta(minutes=15).seconds
    )

    group.update(seer_autofix_last_triggered=timezone.now())

    # log billing event for seer autofix
    quotas.backend.record_seer_run(
        group.organization.id, group.project.id, DataCategory.SEER_AUTOFIX
    )

    return Response(
        {
            "run_id": run_id,
        },
        status=202,
    )
