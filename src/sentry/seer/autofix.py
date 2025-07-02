from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from rest_framework.response import Response

from sentry import eventstore, features, quotas
from sentry.api.serializers import EventSerializer, serialize
from sentry.autofix.utils import get_autofix_repos_from_project_code_mappings
from sentry.constants import DataCategory, ObjectStatus
from sentry.eventstore.models import Event, GroupEvent
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.profiles.utils import get_from_profiling_service
from sentry.search.events.types import EventsResponse, SnubaParams
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.snuba import ourlogs
from sentry.snuba.dataset import Dataset
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

    results: EventsResponse = ourlogs.query(
        selected_columns=[
            "project.id",
            "timestamp",
            "message",
            "severity",
            "code.file.path",
            "code.function.name",
        ],
        query=f"trace:{trace_id}",
        snuba_params=snuba_params,
        orderby=["-timestamp"],
        offset=0,
        limit=100,
        referrer=Referrer.API_GROUP_AI_AUTOFIX,
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
    Calculates accurate durations for all nodes based on call stack transitions.
    """
    profile = profile_data.get("profile")
    if not profile:
        return []

    frames = profile.get("frames")
    stacks = profile.get("stacks")
    samples = profile.get("samples")
    if not all([frames, stacks, samples]):
        return []

    # Find the MainThread ID
    thread_metadata = profile.get("thread_metadata", {}) or {}
    main_thread_id = next(
        (key for key, value in thread_metadata.items() if value.get("name") == "MainThread"), None
    )
    if (
        not main_thread_id and len(thread_metadata) == 1
    ):  # if there is only one thread, use that as the main thread
        main_thread_id = list(thread_metadata.keys())[0]

    # Sort samples chronologically
    sorted_samples = sorted(samples, key=lambda x: x["elapsed_since_start_ns"])

    # Calculate average sampling interval
    if len(sorted_samples) >= 2:
        time_diffs = [
            sorted_samples[i + 1]["elapsed_since_start_ns"]
            - sorted_samples[i]["elapsed_since_start_ns"]
            for i in range(len(sorted_samples) - 1)
        ]
        sample_interval_ns = sum(time_diffs) / len(time_diffs) if time_diffs else 10000000
    else:
        sample_interval_ns = 10000000  # default 10ms

    def create_frame_node(frame_index: int) -> dict[str, Any]:
        """Create a node representation for a single frame"""
        frame = frames[frame_index]
        return {
            "function": frame.get("function", ""),
            "module": frame.get("module", ""),
            "filename": frame.get("filename", ""),
            "lineno": frame.get("lineno", 0),
            "in_app": frame.get("in_app", False),
            "children": [],
            "node_id": None,
            "sample_count": 0,
            "first_seen_ns": None,
            "last_seen_ns": None,
            "duration_ns": None,
        }

    def get_node_path(node: dict[str, Any], parent_path: str = "") -> str:
        """Generate a unique path identifier for a node"""
        return f"{parent_path}/{node['function']}:{node['filename']}:{node['lineno']}"

    def find_or_create_child(parent: dict[str, Any], frame_data: dict[str, Any]) -> dict[str, Any]:
        """Find existing child node or create new one"""
        for child in parent["children"]:
            if (
                child["function"] == frame_data["function"]
                and child["module"] == frame_data["module"]
                and child["filename"] == frame_data["filename"]
                and child["lineno"] == frame_data["lineno"]
            ):
                return child

        parent["children"].append(frame_data)
        return frame_data

    def process_stack(stack_index):
        """Extract app frames from a stack trace"""
        frame_indices = stacks[stack_index]
        if not frame_indices:
            return []

        # Create nodes for app frames only, maintaining order (bottom to top)
        nodes = []
        for idx in reversed(frame_indices):
            frame = frames[idx]
            if frame.get("in_app", False) and not (
                frame.get("filename", "").startswith("<")
                and frame.get("filename", "").endswith(">")
            ):
                nodes.append(create_frame_node(idx))

        return nodes

    # Build the execution tree and track call stacks
    execution_tree: list[dict[str, Any]] = []
    call_stack_history: list[tuple[list[str], int]] = []  # [(node_ids, timestamp), ...]
    node_registry: dict[str, dict[str, Any]] = {}  # {node_id: node_reference}

    for sample in sorted_samples:
        if str(sample["thread_id"]) != str(main_thread_id):
            continue

        timestamp_ns = sample["elapsed_since_start_ns"]
        stack_frames = process_stack(sample["stack_id"])
        if not stack_frames:
            continue

        # Process this stack sample
        current_stack_ids = []

        # Find or create root node
        root = None
        for existing_root in execution_tree:
            if (
                existing_root["function"] == stack_frames[0]["function"]
                and existing_root["module"] == stack_frames[0]["module"]
                and existing_root["filename"] == stack_frames[0]["filename"]
                and existing_root["lineno"] == stack_frames[0]["lineno"]
            ):
                root = existing_root
                break

        if root is None:
            root = stack_frames[0]
            execution_tree.append(root)

        # Process root node
        if root["node_id"] is None:
            node_id = get_node_path(root)
            root["node_id"] = node_id
            node_registry[node_id] = root
            root["first_seen_ns"] = timestamp_ns

        root["sample_count"] += 1
        root["last_seen_ns"] = timestamp_ns
        current_stack_ids.append(root["node_id"])

        # Process rest of the stack
        current = root
        current_path = root["node_id"]

        for frame in stack_frames[1:]:
            current = find_or_create_child(current, frame)

            if current["node_id"] is None:
                node_id = get_node_path(current, current_path)
                current["node_id"] = node_id
                node_registry[node_id] = current
                current["first_seen_ns"] = timestamp_ns

            current["sample_count"] += 1
            current["last_seen_ns"] = timestamp_ns
            current_stack_ids.append(current["node_id"])
            current_path = current["node_id"]

        # Record this call stack with its timestamp
        call_stack_history.append((current_stack_ids, timestamp_ns))

    # Calculate function active periods from call stack history
    function_periods: dict[str, list[list[int | None]]] = {}

    for i, (call_path, timestamp) in enumerate(call_stack_history):
        # Mark functions as started
        for node_id in call_path:
            if node_id not in function_periods:
                function_periods[node_id] = []

            # Start a new period if needed
            if not function_periods[node_id] or function_periods[node_id][-1][1] is not None:
                function_periods[node_id].append([timestamp, None])

        # Mark functions that disappeared as ended
        if i > 0:
            prev_call_path = call_stack_history[i - 1][0]
            for node_id in prev_call_path:
                if node_id not in call_path and function_periods.get(node_id):
                    if function_periods[node_id][-1][1] is None:
                        function_periods[node_id][-1][1] = timestamp

    # Handle the last sample - all active functions end
    if call_stack_history:
        last_timestamp = call_stack_history[-1][1]
        last_call_path = call_stack_history[-1][0]

        for node_id in last_call_path:
            if function_periods.get(node_id) and function_periods[node_id][-1][1] is None:
                function_periods[node_id][-1][1] = last_timestamp + sample_interval_ns

    # Calculate durations
    def apply_durations(node):
        """Calculate and set duration for a node and its children"""
        node_id = node["node_id"]

        # Primary method: use function periods if available
        if node_id in function_periods:
            periods = function_periods[node_id]
            total_duration = sum(
                (end - start) for start, end in periods if start is not None and end is not None
            )

            if total_duration > 0:
                node["duration_ns"] = total_duration

        # Apply to all children
        for child in node["children"]:
            apply_durations(child)

        # Fallback methods if needed
        if node["duration_ns"] is None or node["duration_ns"] == 0:
            # Method 1: Use first and last seen timestamps
            if node["first_seen_ns"] is not None and node["last_seen_ns"] is not None:
                node["duration_ns"] = (
                    node["last_seen_ns"] - node["first_seen_ns"] + sample_interval_ns
                )

            # Method 2: Use sample count as an estimate
            elif node["sample_count"] > 0:
                node["duration_ns"] = node["sample_count"] * sample_interval_ns

            # Method 3: Use sum of children's durations
            elif node["children"]:
                child_duration = sum(
                    child["duration_ns"]
                    for child in node["children"]
                    if child["duration_ns"] is not None
                )
                if child_duration > 0:
                    node["duration_ns"] = child_duration

    # Apply durations to all nodes
    for node in execution_tree:
        apply_durations(node)

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
    user: User | AnonymousUser | RpcUser,
    group: Group,
    repos: list[dict],
    serialized_event: dict[str, Any],
    profile: dict[str, Any] | None,
    trace_tree: dict[str, Any] | None,
    logs: dict[str, list[dict]] | None,
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
                "first_seen": group.first_seen.isoformat(),
                "events": [serialized_event],
            },
            "profile": profile,
            "trace_tree": trace_tree,
            "logs": logs,
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
    user: User | AnonymousUser | RpcUser,
    instruction: str | None = None,
    pr_to_comment_on_url: str | None = None,
    auto_run_source: str | None = None,
):
    if not features.has("organizations:gen-ai-features", group.organization, actor=user):
        return _respond_with_error("AI Autofix is not enabled for this project.", 403)

    if group.organization.get_option("sentry:hide_ai_features"):
        return _respond_with_error("AI features are disabled for this organization.", 403)

    if not get_seer_org_acknowledgement(org_id=group.organization.id):
        return _respond_with_error(
            "Seer has not been enabled for this organization. Please open an issue at sentry.io/issues and set up Seer.",
            403,
        )

    # check billing quota for autofix
    has_budget: bool = quotas.backend.has_available_reserved_budget(
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

    try:
        run_id = _call_autofix(
            user=user,
            group=group,
            repos=repos,
            serialized_event=serialized_event,
            profile=profile,
            trace_tree=trace_tree,
            logs=logs,
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
