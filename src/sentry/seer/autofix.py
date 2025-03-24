from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.response import Response

from sentry import eventstore, features
from sentry.api.serializers import EventSerializer, serialize
from sentry.autofix.utils import get_autofix_repos_from_project_code_mappings
from sentry.constants import ObjectStatus
from sentry.eventstore.models import Event, GroupEvent
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.profiles.utils import get_from_profiling_service
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.autofix import check_autofix_status
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser

logger = logging.getLogger(__name__)


TIMEOUT_SECONDS = 60 * 30  # 30 minutes


def build_spans_tree(spans_data: list[dict]) -> list[dict]:
    """
    Builds a hierarchical tree structure from a flat list of spans.

    Handles multiple potential roots and preserves parent-child relationships.
    A span is considered a root if:
    1. It has no parent_span_id, or
    2. Its parent_span_id doesn't match any span_id in the provided data

    Each node in the tree contains the span data and a list of children.
    The tree is sorted by duration (longest spans first) at each level.
    """
    # Maps for quick lookup
    spans_by_id: dict[str, dict] = {}
    children_by_parent_id: dict[str, list[dict]] = {}
    root_spans: list[dict] = []

    # First pass: organize spans by ID and parent_id
    for span in spans_data:
        span_id = span.get("span_id")
        if not span_id:
            continue

        # Deep copy the span to avoid modifying the original
        span_with_children = span.copy()
        span_with_children["children"] = []
        spans_by_id[span_id] = span_with_children

        parent_id = span.get("parent_span_id")
        if parent_id:
            if parent_id not in children_by_parent_id:
                children_by_parent_id[parent_id] = []
            children_by_parent_id[parent_id].append(span_with_children)

    # Second pass: identify root spans
    # A root span is either:
    # 1. A span without a parent_span_id
    # 2. A span whose parent_span_id doesn't match any span_id in our data
    for span_id, span in spans_by_id.items():
        parent_id = span.get("parent_span_id")
        if not parent_id or parent_id not in spans_by_id:
            root_spans.append(span)

    # Third pass: build the tree by connecting children to parents
    for parent_id, children in children_by_parent_id.items():
        if parent_id in spans_by_id:
            parent = spans_by_id[parent_id]
            for child in children:
                # Only add if not already a child
                if child not in parent["children"]:
                    parent["children"].append(child)

    # Function to sort children in each node by duration
    def sort_span_tree(node):
        if node["children"]:
            # Sort children by duration (in descending order to show longest spans first)
            node["children"].sort(
                key=lambda x: float(x.get("duration", "0").split("s")[0]), reverse=True
            )
            # Recursively sort each child's children
            for child in node["children"]:
                sort_span_tree(child)
        del node["parent_span_id"]
        return node

    # Sort the root spans by duration
    root_spans.sort(key=lambda x: float(x.get("duration", "0").split("s")[0]), reverse=True)
    # Apply sorting to the whole tree
    return [sort_span_tree(root) for root in root_spans]


def _get_serialized_event(
    event_id: str, group: Group, user: User | RpcUser | AnonymousUser
) -> tuple[dict[str, Any] | None, Event | GroupEvent | None]:
    event = eventstore.backend.get_event_by_id(group.project.id, event_id, group_id=group.id)

    if not event:
        return None, None

    serialized_event = serialize(event, user, EventSerializer())
    return serialized_event, event


def _get_trace_tree_for_event(event: Event | GroupEvent, project: Project) -> dict[str, Any] | None:
    """
    Returns a tree of errors and transactions in the trace for a given event. Does not include non-transaction/non-error spans to reduce noise.
    """
    trace_id = event.trace_id
    if not trace_id:
        return None

    project_ids = list(
        dict(
            Project.objects.filter(
                organization=project.organization, status=ObjectStatus.ACTIVE
            ).values_list("id", "slug")
        ).keys()
    )
    start = event.datetime - timedelta(days=1)
    end = event.datetime + timedelta(days=1)
    transaction_event_filter = eventstore.Filter(
        project_ids=project_ids,
        conditions=[
            ["trace_id", "=", trace_id],
        ],
        organization_id=project.organization_id,
        start=start,
        end=end,
    )
    transactions = eventstore.backend.get_events(
        filter=transaction_event_filter,
        dataset=Dataset.Transactions,
        referrer=Referrer.API_GROUP_AI_AUTOFIX,
        tenant_ids={"organization_id": project.organization_id},
    )
    error_event_filter = eventstore.Filter(
        project_ids=project_ids,
        conditions=[
            ["trace", "=", trace_id],
        ],
        organization_id=project.organization_id,
        start=start,
        end=end,
    )
    errors = eventstore.backend.get_events(
        filter=error_event_filter,
        referrer=Referrer.API_GROUP_AI_AUTOFIX,
        tenant_ids={"organization_id": project.organization_id},
    )
    results = transactions + errors

    if not results:
        return None

    events_by_span_id: dict[str, dict] = {}
    events_by_parent_span_id: dict[str, list[dict]] = {}
    span_to_transaction: dict[str, dict] = {}  # Maps span IDs to their parent transaction events
    root_events: list[dict] = []
    all_events: list[dict] = []  # Track all events for orphan detection

    # First pass: collect all events and their metadata
    for event in results:
        event_data = event.data
        is_transaction = event_data.get("spans") is not None
        is_error = not is_transaction

        event_node = {
            "event_id": event.event_id,
            "datetime": event_data.get("start_timestamp", float("inf")),
            "span_id": event_data.get("contexts", {}).get("trace", {}).get("span_id"),
            "parent_span_id": event_data.get("contexts", {}).get("trace", {}).get("parent_span_id"),
            "is_transaction": is_transaction,
            "is_error": is_error,
            "is_current_project": event.project_id == project.id,
            "project_slug": event.project.slug,
            "project_id": event.project_id,
            "platform": event.platform,
            "children": [],
        }

        # Add to all_events for later orphan detection
        all_events.append(event_node)

        if is_transaction:
            op = event_data.get("contexts", {}).get("trace", {}).get("op")
            transaction_title = event.title
            duration_obj = (
                event_data.get("breakdowns", {}).get("span_ops", {}).get("total.time", {})
            )
            duration_str = (
                f"{duration_obj.get('value', 0)} {duration_obj.get('unit', 'millisecond')}s"
            )
            profile_id = event_data.get("contexts", {}).get("profile", {}).get("profile_id")

            # Store all span IDs from this transaction for later relationship building
            spans = event_data.get("spans", [])
            span_ids = [span.get("span_id") for span in spans if span.get("span_id")]

            spans_selected_data = [
                {
                    "span_id": span.get("span_id"),
                    "parent_span_id": span.get("parent_span_id"),
                    "title": f"{span.get('op', '')} - {span.get('description', '')}",
                    "data": span.get("data"),
                    "duration": f"{span.get('timestamp', 0) - span.get('start_timestamp', 0)}s",
                }
                for span in spans
            ]
            selected_spans_tree = build_spans_tree(spans_selected_data)

            event_node.update(
                {
                    "title": f"{op} - {transaction_title}" if op else transaction_title,
                    "duration": duration_str,
                    "profile_id": profile_id,
                    "span_ids": span_ids,  # Store for later use
                    "spans": selected_spans_tree,
                }
            )

            # Register this transaction as the parent for all its spans
            for span_id in span_ids:
                if span_id:
                    span_to_transaction[span_id] = event_node
        else:
            title = event.title
            message = event.message if event.message != event.title else None
            transaction_name = event.transaction

            error_title = message or ""
            if title:
                error_title += f"{' - ' if error_title else ''}{title}"
            if transaction_name:
                error_title += f"{' - ' if error_title else ''}occurred in {transaction_name}"

            event_node.update(
                {
                    "title": error_title,
                }
            )

        span_id = event_node["span_id"]
        parent_span_id = event_node["parent_span_id"]

        # Index events by their span_id
        if span_id:
            events_by_span_id[span_id] = event_node

        # Index events by their parent_span_id for easier lookup
        if parent_span_id:
            if parent_span_id not in events_by_parent_span_id:
                events_by_parent_span_id[parent_span_id] = []
            events_by_parent_span_id[parent_span_id].append(event_node)
        else:
            # This is a potential root node (no parent)
            root_events.append(event_node)

    # Second pass: establish parent-child relationships based on the three rules
    for event_node in list(events_by_span_id.values()):
        span_id = event_node["span_id"]
        parent_span_id = event_node["parent_span_id"]

        # Rule 1: An event whose span_id is X is a parent of an event whose parent_span_id is X
        if span_id and span_id in events_by_parent_span_id:
            for child_event in events_by_parent_span_id[span_id]:
                if child_event not in event_node["children"]:
                    event_node["children"].append(child_event)
                    # If this child was previously considered a root, remove it
                    if child_event in root_events:
                        root_events.remove(child_event)

        # Handle case where this event has a parent based on parent_span_id
        if parent_span_id:
            # Rule 1 (other direction): This event's parent_span_id matches another event's span_id
            if parent_span_id in events_by_span_id:
                parent_event = events_by_span_id[parent_span_id]
                if event_node not in parent_event["children"]:
                    parent_event["children"].append(event_node)
                    # If this event was previously considered a root, remove it
                    if event_node in root_events:
                        root_events.remove(event_node)

            # Rule 2: A transaction event that contains a span with span_id X is a parent
            # of an event whose parent_span_id is X
            elif parent_span_id in span_to_transaction:
                parent_event = span_to_transaction[parent_span_id]
                if event_node not in parent_event["children"]:
                    parent_event["children"].append(event_node)
                    # If this event was previously considered a root, remove it
                    if event_node in root_events:
                        root_events.remove(event_node)

        # Rule 3: A transaction event that contains a span with span_id X is a parent
        # of an event whose span_id is X
        if span_id and span_id in span_to_transaction:
            parent_event = span_to_transaction[span_id]
            # Only establish this relationship if there's no more direct relationship
            # (i.e., the event doesn't already have a parent through rules 1 or 2)
            if event_node in root_events:
                if event_node not in parent_event["children"]:
                    parent_event["children"].append(event_node)
                    # Remove from root events since it now has a parent
                    root_events.remove(event_node)

    # Third pass: find orphaned events and add them to root_events
    # These are events with parent_span_id that don't match any span_id
    # and didn't get connected through any of our relationship rules
    for event_node in all_events:
        has_parent = False
        # Check if this event is already a child of any other event
        for other_event in all_events:
            if event_node in other_event["children"]:
                has_parent = True
                break

        # If not a child of any event and not already in root_events, add it
        if not has_parent and event_node not in root_events:
            root_events.append(event_node)

    # Function to recursively sort children by datetime
    def sort_tree(node):
        if node["children"]:
            # Sort children by datetime
            node["children"].sort(key=lambda x: x["datetime"])
            # Recursively sort each child's children
            for child in node["children"]:
                sort_tree(child)
        return node

    # Sort root events by datetime
    root_events.sort(key=lambda x: x["datetime"])
    # Sort children at each level
    sorted_tree = [sort_tree(root) for root in root_events]

    return {
        "trace_id": event.trace_id,
        "org_id": project.organization_id,
        "events": sorted_tree,
    }


def _get_profile_from_trace_tree(
    trace_tree: dict[str, Any] | None, event: Event | GroupEvent | None, project: Project
) -> dict[str, Any] | None:
    """
    Finds the profile for the transaction that contains our error event.
    """
    if not trace_tree or not event:
        return None

    events = trace_tree.get("events", [])
    event_span_id = event.data.get("contexts", {}).get("trace", {}).get("span_id")

    if not event_span_id:
        return None

    # Flatten all events in the tree for easier traversal
    all_events = []

    def collect_all_events(node):
        all_events.append(node)
        for child in node.get("children", []):
            collect_all_events(child)

    for root_node in events:
        collect_all_events(root_node)

    # Find the first transaction that contains the event's span ID
    # or has a span_id matching the event's span_id
    matching_transaction = None
    for node in all_events:
        if node.get("is_transaction", False):
            # Check if this transaction's span_id matches the event_span_id
            if node.get("span_id") == event_span_id:
                matching_transaction = node
                break

            # Check if this transaction contains the event_span_id in its span_ids
            if event_span_id in node.get("span_ids", []):
                matching_transaction = node
                break

    if not matching_transaction or not matching_transaction.get("profile_id"):
        return None

    profile_id = matching_transaction.get("profile_id")

    # Fetch the profile data
    response = get_from_profiling_service(
        "GET",
        f"/organizations/{project.organization_id}/projects/{project.id}/profiles/{profile_id}",
        params={"format": "sample"},
    )

    if response.status == 200:
        profile = orjson.loads(response.data)
        execution_tree = _convert_profile_to_execution_tree(profile)
        output = (
            None
            if not execution_tree
            else {
                "profile_matches_issue": True,  # we don't have a fallback for now
                "execution_tree": execution_tree,
            }
        )
        return output
    else:
        return None


def _convert_profile_to_execution_tree(profile_data: dict) -> list[dict]:
    """
    Converts profile data into a hierarchical representation of code execution,
    including only items from the MainThread and app frames.
    """
    profile = profile_data.get("profile")
    if not profile:
        return []

    frames = profile.get("frames")
    stacks = profile.get("stacks")
    samples = profile.get("samples")

    if not all([frames, stacks, samples]):
        return []

    thread_metadata = profile.get("thread_metadata") or {}
    main_thread_id = None
    for key, value in thread_metadata.items():
        if value.get("name") == "MainThread":
            main_thread_id = key
            break

    def create_frame_node(frame_index: int) -> dict:
        """Create a node representation for a single frame"""
        frame = frames[frame_index]
        return {
            "function": frame.get("function", ""),
            "module": frame.get("module", ""),
            "filename": frame.get("filename", ""),
            "lineno": frame.get("lineno", 0),
            "in_app": frame.get("in_app", False),
            "children": [],
        }

    def find_or_create_child(parent: dict, frame_data: dict) -> dict:
        """Find existing child node or create new one"""
        for child in parent["children"]:
            if (
                child["function"] == frame_data["function"]
                and child["module"] == frame_data["module"]
                and child["filename"] == frame_data["filename"]
            ):
                return child

        parent["children"].append(frame_data)
        return frame_data

    def merge_stack_into_tree(tree: list[dict], stack_frames: list[dict]):
        """Merge a stack trace into the tree"""
        if not stack_frames:
            return

        # Find or create root node
        root = None
        for existing_root in tree:
            if (
                existing_root["function"] == stack_frames[0]["function"]
                and existing_root["module"] == stack_frames[0]["module"]
                and existing_root["filename"] == stack_frames[0]["filename"]
            ):
                root = existing_root
                break

        if root is None:
            root = stack_frames[0]
            tree.append(root)

        # Merge remaining frames
        current = root
        for frame in stack_frames[1:]:
            current = find_or_create_child(current, frame)

    def process_stack(stack_index: int) -> list[dict]:
        """Process a stack and return its frame hierarchy, filtering out non-app frames"""
        frame_indices = stacks[stack_index]

        if not frame_indices:
            return []

        # Create nodes for app frames only, maintaining the correct execution order
        # The frames need to be processed in order from callers to callees (main to helpers)
        # The test expects 'main' to be the root function, followed by 'helper'
        nodes = []
        # Process frame indices in the correct execution order (root/callers first)
        for idx in frame_indices:  # Not reversed - we want main at index 0
            frame = frames[idx]
            if frame.get("in_app", False) and not (
                frame.get("filename", "").startswith("<")
                and frame.get("filename", "").endswith(">")
            ):
                nodes.append(create_frame_node(idx))

        return nodes

    # Process all samples to build execution tree
    execution_tree: list[dict] = []

    for sample in samples:
        stack_id = sample["stack_id"]
        thread_id = sample["thread_id"]

        if not main_thread_id or str(thread_id) != str(main_thread_id):
            continue

        stack_frames = process_stack(stack_id)
        if stack_frames:
            merge_stack_into_tree(execution_tree, stack_frames)

    return execution_tree


def _respond_with_error(reason: str, status: int):
    return Response(
        {
            "detail": reason,
        },
        status=status,
    )


def _call_autofix(
    *,
    user: User | AnonymousUser,
    group: Group,
    repos: list[dict],
    serialized_event: dict[str, Any],
    profile: dict[str, Any] | None,
    trace_tree: dict[str, Any] | None,
    instruction: str | None = None,
    timeout_secs: int = TIMEOUT_SECONDS,
    pr_to_comment_on_url: str | None = None,
    auto_run_source: str | None = None,
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
                "events": [serialized_event],
            },
            "profile": profile,
            "trace_tree": trace_tree,
            "instruction": instruction,
            "timeout_secs": timeout_secs,
            "last_updated": datetime.now().isoformat(),
            "invoking_user": (
                {
                    "id": user.id,
                    "display_name": user.get_display_name(),
                }
                if not isinstance(user, AnonymousUser)
                else None
            ),
            "options": {
                "comment_on_pr_with_url": pr_to_comment_on_url,
                "auto_run_source": auto_run_source,
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


def trigger_autofix(
    *,
    group: Group,
    event_id: str | None = None,
    user: User | AnonymousUser,
    instruction: str | None = None,
    pr_to_comment_on_url: str | None = None,
    auto_run_source: str | None = None,
):
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

    if not (
        features.has("organizations:gen-ai-features", group.organization, actor=user)
        and group.organization.get_option("sentry:gen_ai_consent_v2024_11_14", False)
    ):
        return _respond_with_error("AI Autofix is not enabled for this project.", 403)

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

    try:
        run_id = _call_autofix(
            user=user,
            group=group,
            repos=repos,
            serialized_event=serialized_event,
            profile=profile,
            trace_tree=trace_tree,
            instruction=instruction,
            timeout_secs=TIMEOUT_SECONDS,
            pr_to_comment_on_url=pr_to_comment_on_url,
            auto_run_source=auto_run_source,
        )
    except Exception:
        logger.exception("Failed to send autofix to seer")

        return _respond_with_error(
            "Autofix failed to start.",
            500,
        )

    check_autofix_status.apply_async(args=[run_id], countdown=timedelta(minutes=15).seconds)

    return Response(
        {
            "run_id": run_id,
        },
        status=202,
    )
