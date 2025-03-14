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
    event_filter = eventstore.Filter(
        project_ids=project_ids,
        conditions=[
            ["trace_id", "=", trace_id],
        ],
    )
    transactions = eventstore.backend.get_events(
        filter=event_filter,
        dataset=Dataset.Transactions,
        referrer=Referrer.API_GROUP_AI_AUTOFIX,
        tenant_ids={"organization_id": project.organization_id},
    )
    errors = eventstore.backend.get_events(
        filter=event_filter,
        dataset=Dataset.Events,
        referrer=Referrer.API_GROUP_AI_AUTOFIX,
        tenant_ids={"organization_id": project.organization_id},
    )
    results = transactions + errors

    if not results:
        return None

    events_by_span_id: dict[str, dict] = {}
    children_by_parent_span_id: dict[str, list[dict]] = {}
    root_events: list[dict] = []

    # First pass: collect all events and their relationships
    for event in results:
        event_data = event.data
        is_transaction = event_data.get("spans") is not None
        is_error = not is_transaction

        event_node = {
            "event_id": event.event_id,
            "datetime": event.datetime,
            "span_id": event_data.get("contexts", {}).get("trace", {}).get("span_id"),
            "parent_span_id": event_data.get("contexts", {}).get("trace", {}).get("parent_span_id"),
            "is_transaction": is_transaction,
            "is_error": is_error,
            "children": [],
        }

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
            event_node.update(
                {
                    "title": f"{op} - {transaction_title}" if op else transaction_title,
                    "platform": event.platform,
                    "is_current_project": event.project_id == project.id,
                    "duration": duration_str,
                    "profile_id": profile_id,
                    "children_span_ids": [
                        span.get("span_id") for span in event_data.get("spans", [])
                    ],
                }
            )
        else:
            event_node.update(
                {
                    "title": event.title,
                    "platform": event.platform,
                    "is_current_project": event.project_id == project.id,
                }
            )

        span_id = event_node["span_id"]
        parent_span_id = event_node["parent_span_id"]

        if span_id:
            events_by_span_id[span_id] = event_node

        # Add to children list of parent
        if parent_span_id:
            if parent_span_id not in children_by_parent_span_id:
                children_by_parent_span_id[parent_span_id] = []
            children_by_parent_span_id[parent_span_id].append(event_node)
        else:
            # This is a root node (no parent)
            root_events.append(event_node)

        # Handle case where this event's span is a parent for events we've already seen
        if span_id and span_id in children_by_parent_span_id:
            event_node["children"].extend(children_by_parent_span_id[span_id])
            children_by_parent_span_id[span_id] = event_node["children"]

    # Second pass: add children from spans to parent events
    for span_id, event_node in events_by_span_id.items():
        if event_node["is_transaction"] and "children_span_ids" in event_node:
            for child_span_id in event_node["children_span_ids"]:
                # If this span ID belongs to another event, establish parent-child relationship
                if (
                    child_span_id in events_by_span_id
                    and events_by_span_id[child_span_id] not in event_node["children"]
                ):
                    event_node["children"].append(events_by_span_id[child_span_id])

    # Third pass: connect any remaining children to their parents
    for parent_span_id, children in children_by_parent_span_id.items():
        if parent_span_id in events_by_span_id:
            parent_node = events_by_span_id[parent_span_id]
            for child in children:
                if child not in parent_node["children"]:
                    parent_node["children"].append(child)

    # Fourth pass: find orphaned events (events with parent_span_id but no actual parent) and add them to root_events
    all_event_nodes = list(events_by_span_id.values())
    for event_node in all_event_nodes:
        parent_span_id = event_node.get("parent_span_id")
        if (
            parent_span_id
            and parent_span_id not in events_by_span_id
            and event_node not in root_events
        ):
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

    # Clean up temporary fields before returning
    def cleanup_node(node):
        if "children_span_ids" in node:
            del node["children_span_ids"]
        for child in node["children"]:
            cleanup_node(child)
        return node

    cleaned_tree = [cleanup_node(root) for root in sorted_tree]

    return {"trace_id": event.trace_id, "events": cleaned_tree}


def _get_profile_from_trace_tree(
    trace_tree: dict[str, Any] | None, event: Event | GroupEvent | None, project: Project
) -> dict[str, Any] | None:
    """
    Finds the profile for the transaction that is a parent of our error event.
    """
    if not trace_tree or not event:
        return None

    events = trace_tree.get("events", [])
    event_id = event.event_id

    # First, find our error event in the tree and track parent transactions
    # 1. Find the error event node and also build a map of parent-child relationships
    # 2. Walk up from the error event to find a transaction with a profile

    child_to_parent = {}

    def build_parent_map(node, parent=None):
        node_id = node.get("event_id")

        if parent:
            child_to_parent[node_id] = parent

        for child in node.get("children", []):
            build_parent_map(child, node)

    # Build the parent-child map for the entire tree
    for root_node in events:
        build_parent_map(root_node)

    # Find our error node in the flattened tree
    error_node = None
    all_nodes = []

    def collect_all_nodes(node):
        all_nodes.append(node)
        for child in node.get("children", []):
            collect_all_nodes(child)

    for root_node in events:
        collect_all_nodes(root_node)

    for node in all_nodes:
        if node.get("event_id") == event_id:
            error_node = node
            break

    if not error_node:
        return None

    # Now walk up the tree to find a transaction with a profile
    profile_id = None
    current_node = error_node
    while current_node:
        if current_node.get("profile_id"):
            profile_id = current_node.get("profile_id")
            break

        # Move up to parent - child_to_parent maps child event IDs to parent node objects
        parent_node = child_to_parent.get(current_node.get("event_id"))
        if not parent_node:
            # Reached the root without finding a suitable transaction
            return None
        current_node = parent_node

    if not profile_id:
        return None

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
    user: User | AnonymousUser,
    group: Group,
    repos: list[dict],
    serialized_event: dict[str, Any],
    profile: dict[str, Any] | None,
    trace_tree: dict[str, Any] | None,
    instruction: str | None = None,
    timeout_secs: int = TIMEOUT_SECONDS,
    pr_to_comment_on_url: str | None = None,
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

    if not any(
        [
            entry.get("type") == "exception" or entry.get("type") == "threads"
            for entry in serialized_event["entries"]
        ]
    ):
        return _respond_with_error("Cannot fix issues without a stacktrace.", 400)

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
            user,
            group,
            repos,
            serialized_event,
            profile,
            trace_tree,
            instruction,
            TIMEOUT_SECONDS,
            pr_to_comment_on_url,
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
