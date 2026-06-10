from __future__ import annotations

import concurrent.futures
import logging
from datetime import datetime, timedelta
from typing import Any

from sentry_sdk import start_span

from sentry import tagstore
from sentry.api.endpoints.organization_trace import OrganizationTraceEndpoint
from sentry.constants import ObjectStatus
from sentry.issues.grouptype import WebVitalsGroup
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.search.events.types import SnubaParams
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.referrer import Referrer
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)


def get_trace_tree_for_event(
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
        trace = trace_endpoint.query_trace_data(
            snuba_params,
            trace_id,
            Referrer.SEER_AUTOFIX_GET_TRACE_EVENTS.value,
            organization=project.organization,
        )

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
        with start_span(op="seer.autofix.get_trace_tree_for_event"):
            with ContextPropagatingThreadPoolExecutor() as executor:
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


def get_all_tags_overview(
    group: Group, start: datetime | None = None, end: datetime | None = None
) -> dict[str, Any] | None:
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
        start=start,
        end=end,
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
